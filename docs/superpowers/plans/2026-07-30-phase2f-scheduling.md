# 階段 2f · 排程工作 · 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 過期活動自動轉 ended、活動開始前 24 小時通知報名者，皆由 pg_cron 定期執行的 SQL 函式完成。

**Architecture:** 兩個冪等 SQL 工作函式（`expire_past_events` / `notify_upcoming_events`），以 pg_cron 定期呼叫；expire 透過 `app.system_op` session 旗標繞過 0008 的狀態守門；通知沿用 2d 的 `notify()`。函式邏輯以整合測試直接呼叫驗證，不依賴排程觸發。

**Tech Stack:** Supabase（Postgres、pg_cron、trigger、RLS）、Vitest（本機 DB 整合 + 純函式單元）。

**Scope:** 對應 spec `docs/superpowers/specs/2026-07-30-phase2f-scheduling-design.md`。不含 UI（通知自動出現在 2d 鈴鐺）、Banner（2e）。既有 migration 0001–0009；新增 0010。

本機 Supabase：API `http://127.0.0.1:54321`。整合測試以 `SUPABASE_TEST_URL` / `SUPABASE_TEST_ANON_KEY` / `SUPABASE_TEST_SERVICE_KEY` 傳入本機 key。整合測試用 service_role 的**未型別** client 呼叫函式即可（不需重生 `lib/database.types.ts`：app 端不呼叫這兩個函式，且 notifications.type 的產生型別本就是 string）。

---

## File Structure

- `supabase/migrations/0010_scheduling.sql` — type 擴充 + 守門旁路 + 兩個工作函式 + pg_cron 排程（容錯）。
- `lib/types.ts` — `NotificationType` 加 `starting_soon`（修改）。
- `lib/notifications-logic.ts` — `notificationMessage` 加 `starting_soon`（修改）。
- 測試置於 `tests/`。

---

## Task 1: migration 0010（工作函式 + 排程）

**Files:**
- Create: `supabase/migrations/0010_scheduling.sql`
- Create: `tests/db/scheduling.test.ts`

- [ ] **Step 1: 寫 migration**

Create `supabase/migrations/0010_scheduling.sql`:
```sql
-- 1) notifications type 擴充：加入 starting_soon
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('registered','waitlisted','promoted','moderation_approved','moderation_rejected','starting_soon'));

-- 2) 守門 trigger 加系統操作旁路（其餘行為不變）
create or replace function public.guard_event_status() returns trigger
language plpgsql security definer as $$
begin
  if coalesce(current_setting('app.system_op', true), '') = 'on' then return new; end if;
  if public.is_admin() then return new; end if;
  if new.status is distinct from old.status then
    if not (old.status = 'rejected' and new.status = 'pending') then
      raise exception 'not allowed to change event status';
    end if;
  end if;
  return new;
end; $$;

-- 3) 過期活動 → ended（設 app.system_op 旁路守門）
create or replace function public.expire_past_events() returns int
language plpgsql security definer as $$
declare v_count int;
begin
  perform set_config('app.system_op', 'on', true);
  update public.events set status = 'ended'
    where status = 'published' and end_at < now();
  get diagnostics v_count = row_count;
  return v_count;
end; $$;

-- 4) 開始前 24h 通知 registered 報名者（去重）
create or replace function public.notify_upcoming_events() returns int
language plpgsql security definer as $$
declare v_count int := 0; r record;
begin
  for r in
    select reg.user_id, e.id as event_id
    from public.events e
    join public.registrations reg on reg.event_id = e.id and reg.status = 'registered'
    where e.status = 'published'
      and e.start_at > now()
      and e.start_at <= now() + interval '24 hours'
      and not exists (
        select 1 from public.notifications n
        where n.user_id = reg.user_id
          and n.type = 'starting_soon'
          and n.payload->>'eventId' = e.id::text
      )
  loop
    perform public.notify(r.user_id, 'starting_soon', r.event_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end; $$;
grant execute on function public.expire_past_events() to service_role;
grant execute on function public.notify_upcoming_events() to service_role;

-- 5) pg_cron 排程（容錯：本機若無 pg_cron 不致使 migration 失敗）
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule('expire-past-events') where exists (select 1 from cron.job where jobname = 'expire-past-events');
  perform cron.unschedule('notify-upcoming-events') where exists (select 1 from cron.job where jobname = 'notify-upcoming-events');
  perform cron.schedule('expire-past-events', '*/15 * * * *', 'select public.expire_past_events()');
  perform cron.schedule('notify-upcoming-events', '*/15 * * * *', 'select public.notify_upcoming_events()');
exception when others then
  raise notice 'pg_cron scheduling skipped: %', sqlerrm;
end $$;
```

- [ ] **Step 2: 套用**

Run: `npx supabase db reset`
Expected: 0001–0010 皆套用成功（若本機無 pg_cron，會印 `notice pg_cron scheduling skipped`，但 migration 仍成功）。

- [ ] **Step 3: 整合測試**

Create `tests/db/scheduling.test.ts`:
```ts
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, test } from 'vitest'

const url = process.env.SUPABASE_TEST_URL
const anon = process.env.SUPABASE_TEST_ANON_KEY
const service = process.env.SUPABASE_TEST_SERVICE_KEY

async function makeUser(admin: SupabaseClient) {
  return (await admin.auth.admin.createUser({ email: `u-${crypto.randomUUID()}@x.com`, email_confirm: true })).data.user!.id
}
async function makeEvent(admin: SupabaseClient, organizer: string, opts: { status?: string; startInHours?: number; endInHours?: number }) {
  const now = Date.now()
  const { data } = await admin.from('events').insert({
    organizer_id: organizer, title: '排程測試活動', city: '台北市', district: '大安區',
    start_at: new Date(now + (opts.startInHours ?? 48) * 3600000).toISOString(),
    end_at: new Date(now + (opts.endInHours ?? 50) * 3600000).toISOString(),
    status: opts.status ?? 'published',
  }).select('id').single()
  return data!.id as string
}

describe.skipIf(!url || !anon || !service)('scheduling functions', () => {
  let admin: SupabaseClient
  beforeEach(() => { admin = createClient(url!, service!) })

  test('expire_past_events：過期 published → ended，未過期不動', async () => {
    const org = await makeUser(admin)
    const past = await makeEvent(admin, org, { status: 'published', startInHours: -50, endInHours: -2 })
    const future = await makeEvent(admin, org, { status: 'published', startInHours: 48, endInHours: 50 })
    await admin.rpc('expire_past_events')
    const { data: p } = await admin.from('events').select('status').eq('id', past).single()
    const { data: f } = await admin.from('events').select('status').eq('id', future).single()
    expect(p!.status).toBe('ended')
    expect(f!.status).toBe('published')
  })

  test('notify_upcoming_events：24h 內活動的 registered 報名者收到一次 starting_soon', async () => {
    const org = await makeUser(admin)
    const soon = await makeEvent(admin, org, { status: 'published', startInHours: 12, endInHours: 14 })
    const uid = await makeUser(admin)
    await admin.from('registrations').insert({ event_id: soon, user_id: uid, status: 'registered' })
    // 呼叫兩次，驗證去重
    await admin.rpc('notify_upcoming_events')
    await admin.rpc('notify_upcoming_events')
    const { data } = await admin.from('notifications').select('type').eq('user_id', uid).eq('type', 'starting_soon')
    expect(data!.length).toBe(1)
  })

  test('notify_upcoming_events：>24h 的活動不發', async () => {
    const org = await makeUser(admin)
    const later = await makeEvent(admin, org, { status: 'published', startInHours: 48, endInHours: 50 })
    const uid = await makeUser(admin)
    await admin.from('registrations').insert({ event_id: later, user_id: uid, status: 'registered' })
    await admin.rpc('notify_upcoming_events')
    const { data } = await admin.from('notifications').select('id').eq('user_id', uid).eq('type', 'starting_soon')
    expect(data!.length).toBe(0)
  })

  test('notify_upcoming_events：waitlist 報名者不發', async () => {
    const org = await makeUser(admin)
    const soon = await makeEvent(admin, org, { status: 'published', startInHours: 12, endInHours: 14 })
    const uid = await makeUser(admin)
    await admin.from('registrations').insert({ event_id: soon, user_id: uid, status: 'waitlist' })
    await admin.rpc('notify_upcoming_events')
    const { data } = await admin.from('notifications').select('id').eq('user_id', uid).eq('type', 'starting_soon')
    expect(data!.length).toBe(0)
  })
})
```

- [ ] **Step 4: 執行測試**

Run（帶三個環境變數）: `npm test tests/db/scheduling.test.ts` → 4 passed。
帶 env 跑整個 `npm test tests/db` 確認無回歸（尤其 dashboard-guard 的守門測試仍過）。裸 `npm test` 全綠。

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0010_scheduling.sql tests/db/scheduling.test.ts
git commit -m "feat: scheduled expire and upcoming-notification functions"
```

---

## Task 2: `starting_soon` 通知型別與訊息

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/notifications-logic.ts`
- Modify: `tests/notifications/message.test.ts`

- [ ] **Step 1: 先加失敗測試**

在 `tests/notifications/message.test.ts` 追加：
```ts
test('即將開始訊息', () => {
  expect(notificationMessage('starting_soon', { eventId: 'e1', eventTitle: '晨跑' }))
    .toBe('活動即將開始：晨跑')
})
```
Run: `npm test tests/notifications/message.test.ts` → 新增測試 FAIL（型別/case 尚未支援）。

- [ ] **Step 2: 型別加 starting_soon**

在 `lib/types.ts` 的 `NotificationType` 聯集末端加入 `| 'starting_soon'`：
```ts
export type NotificationType =
  | 'registered' | 'waitlisted' | 'promoted' | 'moderation_approved' | 'moderation_rejected' | 'starting_soon'
```

- [ ] **Step 3: notificationMessage 加 case**

在 `lib/notifications-logic.ts` 的 `switch` 加入（放在 `moderation_rejected` 之前或之後皆可）：
```ts
    case 'starting_soon': return `活動即將開始：${t}`
```

- [ ] **Step 4: 執行測試**

Run: `npm test tests/notifications/message.test.ts` → 全數 PASS。
`npx tsc --noEmit`（零錯誤）、`npm run build`（成功）、裸 `npm test`（全綠）。

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/notifications-logic.ts tests/notifications/message.test.ts
git commit -m "feat: starting_soon notification type and message"
```

---

## 完成後的可運作成果

- 過期的已上架活動由排程自動轉為 `ended`（前台自動移除；守門 trigger 以系統旁路允許）。
- 活動開始前 24 小時，每位 registered 報名者收到一次「活動即將開始」通知，出現在 2d 鈴鐺。
- 兩個函式冪等、可本機直接呼叫測試；pg_cron 排程每 15 分鐘執行（本機無 pg_cron 亦不影響 migration 與函式）。

## 下一步（各自另出計畫）
- **2b** 收藏、**2e** Banner。
- 全面拋光。
