# 階段 2a · 報名 + 候補 · 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓登入會員在活動詳情頁站內報名，含名額上限、額滿候補、報名截止、隨時取消並自動遞補，併發正確。

**Architecture:** 報名/取消/遞補邏輯集中在 Postgres RPC 函式（交易 + 行鎖，原子）；Server Action 薄封裝；讀取面以定義者權限的 view/函式提供公開計數與本人報名狀態；UI 為詳情頁上的報名狀態機，沿用既有設計系統。

**Tech Stack:** Next.js 15、Supabase（Postgres RPC、RLS）、Vitest（單元 + 對本機 DB 的整合測試）、既有 `components/ui`（Button、Chip）與色彩 token。

**Scope:** 對應 spec `docs/superpowers/specs/2026-07-29-phase2a-registration-design.md`。不含發通知（2d）、CSV 匯出/主辦方後台（2c）。既有 migration 為 0001–0004；本計畫新增 0005–0007。

本機 Supabase（Docker 已用過）：API `http://127.0.0.1:54321`；測試以環境變數 `SUPABASE_TEST_URL` / `SUPABASE_TEST_ANON_KEY` / `SUPABASE_TEST_SERVICE_KEY` 傳入本機 anon / service_role key（`npx supabase status` 可取得）。

---

## File Structure

- `supabase/migrations/0005_registrations.sql` — registrations 表 + RLS + grants。
- `supabase/migrations/0006_registration_rpc.sql` — `register_for_event` / `cancel_registration`。
- `supabase/migrations/0007_registration_reads.sql` — `event_registered_counts` view + `get_my_registration` 函式。
- `lib/events/registration-logic.ts` — 純邏輯（`parseRegistrationFields`），可單元測試、無 server-only 匯入。
- `lib/events/registration.ts` — server actions（`register` / `cancelRegistration`）。
- `lib/types.ts` — 新增報名相關型別（修改）。
- `lib/events/queries.ts` — 併回計數與本人報名狀態（修改）。
- `components/RegistrationPanel.tsx` — 詳情頁報名狀態機（client）。
- `app/events/[id]/page.tsx` — 崁入 RegistrationPanel（修改）。
- `components/EventForm.tsx` + `lib/events/actions.ts` — 主辦方 registration_fields 開關（修改）。
- 測試置於 `tests/`。

---

## Task 1: registrations 表 + RLS + grants

**Files:**
- Create: `supabase/migrations/0005_registrations.sql`
- Create: `tests/db/registrations.test.ts`

- [ ] **Step 1: 寫 migration**

Create `supabase/migrations/0005_registrations.sql`:
```sql
create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('registered','waitlist','cancelled')),
  party_size int not null default 1 check (party_size >= 1),
  form_answers jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- 一位使用者對一個活動只能有一筆有效（未取消）報名
create unique index registrations_active_uniq
  on public.registrations (event_id, user_id)
  where status <> 'cancelled';

-- 計數與候補排序
create index registrations_event_status_idx
  on public.registrations (event_id, status, created_at);

alter table public.registrations enable row level security;

-- 本人 / 該活動主辦方 / admin 可讀
create policy registrations_read on public.registrations
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid())
    or public.is_admin()
  );
-- 一般寫入僅限本人（RPC 以 definer 權限運作，不受此限）
create policy registrations_insert on public.registrations
  for insert with check (user_id = auth.uid());
create policy registrations_update on public.registrations
  for update using (user_id = auth.uid());

grant select, insert, update on public.registrations to authenticated;
grant select on public.registrations to anon;
grant all on public.registrations to service_role;
```

- [ ] **Step 2: 套用**

Run: `npx supabase db reset`
Expected: 0001–0005 皆套用成功。

- [ ] **Step 3: 寫整合測試（RLS：名單隱私）**

Create `tests/db/registrations.test.ts`:
```ts
import { createClient } from '@supabase/supabase-js'
import { describe, expect, test } from 'vitest'

const url = process.env.SUPABASE_TEST_URL
const anon = process.env.SUPABASE_TEST_ANON_KEY
const service = process.env.SUPABASE_TEST_SERVICE_KEY

describe.skipIf(!url || !anon || !service)('registrations RLS', () => {
  test('會員看不到他人活動的報名者', async () => {
    const admin = createClient(url!, service!)
    // 主辦方 A 與其活動
    const a = (await admin.auth.admin.createUser({ email: `a-${crypto.randomUUID()}@x.com`, password: 'pw', email_confirm: true })).data.user!
    const { data: ev } = await admin.from('events').insert({
      organizer_id: a.id, title: 'evt', city: '台北市', district: '大安區',
      start_at: new Date(Date.now()+86400000).toISOString(),
      end_at: new Date(Date.now()+90000000).toISOString(), status: 'published',
    }).select('id').single()
    // 報名者 B
    const b = (await admin.auth.admin.createUser({ email: `b-${crypto.randomUUID()}@x.com`, password: 'pw', email_confirm: true })).data.user!
    await admin.from('registrations').insert({ event_id: ev!.id, user_id: b.id, status: 'registered' })

    // 第三者 C（一般會員）登入後查該活動報名
    const cEmail = `c-${crypto.randomUUID()}@x.com`
    await admin.auth.admin.createUser({ email: cEmail, password: 'pw', email_confirm: true })
    const cClient = createClient(url!, anon!)
    await cClient.auth.signInWithPassword({ email: cEmail, password: 'pw' })
    const { data } = await cClient.from('registrations').select('id').eq('event_id', ev!.id)
    expect(data).toEqual([]) // 看不到別人的報名
  })
})
```

- [ ] **Step 4: 執行測試**

Run: `SUPABASE_TEST_URL=http://127.0.0.1:54321 SUPABASE_TEST_ANON_KEY=<anon> SUPABASE_TEST_SERVICE_KEY=<service> npm test tests/db/registrations.test.ts`
Expected: PASS。並跑裸 `npm test` 確認全綠。

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0005_registrations.sql tests/db/registrations.test.ts
git commit -m "feat: registrations table with RLS and grants"
```

---

## Task 2: 報名/取消 RPC 函式（原子 + 候補）

**Files:**
- Create: `supabase/migrations/0006_registration_rpc.sql`
- Create: `tests/db/registration-rpc.test.ts`

- [ ] **Step 1: 寫 RPC migration**

Create `supabase/migrations/0006_registration_rpc.sql`:
```sql
-- 報名：原子檢查名額並決定 registered / waitlist
create or replace function public.register_for_event(
  p_event_id uuid, p_party_size int default 1, p_form_answers jsonb default '{}'
) returns text
language plpgsql security definer as $$
declare
  v_event public.events;
  v_uid uuid := auth.uid();
  v_count int;
  v_status text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select * into v_event from public.events where id = p_event_id for update;
  if not found or v_event.status <> 'published' then
    raise exception 'event not available';
  end if;
  if now() >= v_event.start_at then raise exception 'event already started'; end if;
  if v_event.registration_deadline is not null and now() >= v_event.registration_deadline then
    raise exception 'registration closed';
  end if;
  if exists (select 1 from public.registrations
             where event_id = p_event_id and user_id = v_uid and status <> 'cancelled') then
    raise exception 'already registered';
  end if;

  select count(*) into v_count from public.registrations
    where event_id = p_event_id and status = 'registered';
  if v_event.capacity is null or v_count < v_event.capacity then
    v_status := 'registered';
  else
    v_status := 'waitlist';
  end if;

  insert into public.registrations (event_id, user_id, status, party_size, form_answers)
    values (p_event_id, v_uid, v_status, greatest(coalesce(p_party_size,1),1), coalesce(p_form_answers,'{}'));
  return v_status;
end; $$;

-- 取消：若原為 registered 且有候補，遞補最早一位，回傳被遞補者 id
create or replace function public.cancel_registration(p_event_id uuid)
returns uuid
language plpgsql security definer as $$
declare
  v_uid uuid := auth.uid();
  v_event public.events;
  v_prev text;
  v_promoted uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select * into v_event from public.events where id = p_event_id for update;
  if not found then raise exception 'event not found'; end if;
  if now() >= v_event.start_at then raise exception 'event already started'; end if;

  -- 先讀原狀態（並鎖住該報名列），再更新為 cancelled
  select status into v_prev from public.registrations
    where event_id = p_event_id and user_id = v_uid and status <> 'cancelled'
    for update;
  if v_prev is null then raise exception 'no active registration'; end if;
  update public.registrations set status = 'cancelled'
    where event_id = p_event_id and user_id = v_uid and status <> 'cancelled';

  -- 若原為 registered 且有候補，遞補最早一位
  if v_prev = 'registered' then
    update public.registrations set status = 'registered'
      where id = (
        select id from public.registrations
        where event_id = p_event_id and status = 'waitlist'
        order by created_at asc limit 1
      )
      returning user_id into v_promoted;
  end if;
  return v_promoted;
end; $$;

grant execute on function public.register_for_event(uuid,int,jsonb) to authenticated;
grant execute on function public.cancel_registration(uuid) to authenticated;
```

- [ ] **Step 2: 套用**

Run: `npx supabase db reset`
Expected: 成功。

- [ ] **Step 3: 寫整合測試（含併發）**

Create `tests/db/registration-rpc.test.ts`:
```ts
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, test } from 'vitest'

const url = process.env.SUPABASE_TEST_URL
const anon = process.env.SUPABASE_TEST_ANON_KEY
const service = process.env.SUPABASE_TEST_SERVICE_KEY

async function makeUserClient(admin: SupabaseClient) {
  const email = `u-${crypto.randomUUID()}@x.com`
  await admin.auth.admin.createUser({ email, password: 'pw', email_confirm: true })
  const c = createClient(url!, anon!)
  await c.auth.signInWithPassword({ email, password: 'pw' })
  return c
}
async function makeEvent(admin: SupabaseClient, capacity: number | null) {
  const organizer = (await admin.auth.admin.createUser({ email: `o-${crypto.randomUUID()}@x.com`, password: 'pw', email_confirm: true })).data.user!
  const { data } = await admin.from('events').insert({
    organizer_id: organizer.id, title: 'evt', city: '台北市', district: '大安區',
    start_at: new Date(Date.now()+86400000).toISOString(),
    end_at: new Date(Date.now()+90000000).toISOString(),
    status: 'published', capacity,
  }).select('id').single()
  return data!.id as string
}

describe.skipIf(!url || !anon || !service)('registration RPC', () => {
  let admin: SupabaseClient
  beforeEach(() => { admin = createClient(url!, service!) })

  test('未滿給 registered，滿了給 waitlist', async () => {
    const eventId = await makeEvent(admin, 1)
    const u1 = await makeUserClient(admin)
    const u2 = await makeUserClient(admin)
    const r1 = await u1.rpc('register_for_event', { p_event_id: eventId })
    const r2 = await u2.rpc('register_for_event', { p_event_id: eventId })
    expect(r1.data).toBe('registered')
    expect(r2.data).toBe('waitlist')
  })

  test('取消 registered → 最早候補遞補', async () => {
    const eventId = await makeEvent(admin, 1)
    const u1 = await makeUserClient(admin)
    const u2 = await makeUserClient(admin)
    await u1.rpc('register_for_event', { p_event_id: eventId })
    await u2.rpc('register_for_event', { p_event_id: eventId }) // waitlist
    const cancel = await u1.rpc('cancel_registration', { p_event_id: eventId })
    expect(cancel.data).not.toBeNull() // 回傳被遞補者 id
    const { data: u2reg } = await admin.from('registrations')
      .select('status').eq('event_id', eventId).eq('user_id', (await u2.auth.getUser()).data.user!.id).single()
    expect(u2reg!.status).toBe('registered')
  })

  test('重複報名被擋', async () => {
    const eventId = await makeEvent(admin, null)
    const u1 = await makeUserClient(admin)
    await u1.rpc('register_for_event', { p_event_id: eventId })
    const again = await u1.rpc('register_for_event', { p_event_id: eventId })
    expect(again.error).not.toBeNull()
  })

  test('併發搶最後一位：只有一位 registered', async () => {
    const eventId = await makeEvent(admin, 1)
    const u1 = await makeUserClient(admin)
    const u2 = await makeUserClient(admin)
    const [r1, r2] = await Promise.all([
      u1.rpc('register_for_event', { p_event_id: eventId }),
      u2.rpc('register_for_event', { p_event_id: eventId }),
    ])
    const results = [r1.data, r2.data].sort()
    expect(results).toEqual(['registered', 'waitlist'])
  })
})
```

- [ ] **Step 4: 執行測試**

Run（帶三個環境變數）: `npm test tests/db/registration-rpc.test.ts`
Expected: 4 passed。裸 `npm test` 全綠。

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0006_registration_rpc.sql tests/db/registration-rpc.test.ts
git commit -m "feat: atomic register/cancel RPC with waitlist promotion"
```

---

## Task 3: 讀取面 — 計數 view + 本人報名狀態函式

**Files:**
- Create: `supabase/migrations/0007_registration_reads.sql`
- Create: `tests/db/registration-reads.test.ts`

- [ ] **Step 1: 寫 migration**

Create `supabase/migrations/0007_registration_reads.sql`:
```sql
-- 公開計數（僅聚合，不外洩個別報名者）。以 view 擁有者權限運作，繞過 registrations RLS。
create view public.event_registered_counts as
  select event_id, count(*)::int as registered_count
  from public.registrations
  where status = 'registered'
  group by event_id;
grant select on public.event_registered_counts to anon, authenticated;

-- 本人對某活動的報名狀態 + 候補序位（definer：可讀他人 waitlist 以算序位，但只回傳本人資訊）
create or replace function public.get_my_registration(p_event_id uuid)
returns table (status text, waitlist_position int)
language plpgsql security definer as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
  v_created timestamptz;
  v_pos int;
begin
  if v_uid is null then return; end if;
  select r.status, r.created_at into v_status, v_created
    from public.registrations r
    where r.event_id = p_event_id and r.user_id = v_uid and r.status <> 'cancelled';
  if v_status is null then return; end if;
  if v_status = 'waitlist' then
    select count(*) + 1 into v_pos from public.registrations
      where event_id = p_event_id and status = 'waitlist' and created_at < v_created;
  end if;
  status := v_status; waitlist_position := v_pos; return next;
end; $$;
grant execute on function public.get_my_registration(uuid) to anon, authenticated;
```

- [ ] **Step 2: 套用**

Run: `npx supabase db reset`
Expected: 成功。

- [ ] **Step 3: 整合測試**

Create `tests/db/registration-reads.test.ts`:
```ts
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, test } from 'vitest'

const url = process.env.SUPABASE_TEST_URL
const anon = process.env.SUPABASE_TEST_ANON_KEY
const service = process.env.SUPABASE_TEST_SERVICE_KEY

describe.skipIf(!url || !anon || !service)('registration reads', () => {
  let admin: SupabaseClient
  beforeEach(() => { admin = createClient(url!, service!) })

  test('計數 view 反映 registered 數；匿名可讀', async () => {
    const organizer = (await admin.auth.admin.createUser({ email: `o-${crypto.randomUUID()}@x.com`, password: 'pw', email_confirm: true })).data.user!
    const { data: ev } = await admin.from('events').insert({
      organizer_id: organizer.id, title: 'evt', city: '台北市', district: '大安區',
      start_at: new Date(Date.now()+86400000).toISOString(),
      end_at: new Date(Date.now()+90000000).toISOString(), status: 'published', capacity: 5,
    }).select('id').single()
    const u = (await admin.auth.admin.createUser({ email: `u-${crypto.randomUUID()}@x.com`, password: 'pw', email_confirm: true })).data.user!
    await admin.from('registrations').insert({ event_id: ev!.id, user_id: u.id, status: 'registered' })

    const anonClient = createClient(url!, anon!)
    const { data } = await anonClient.from('event_registered_counts')
      .select('registered_count').eq('event_id', ev!.id).single()
    expect(data!.registered_count).toBe(1)
  })

  test('get_my_registration 回傳本人狀態與候補序位', async () => {
    const organizer = (await admin.auth.admin.createUser({ email: `o-${crypto.randomUUID()}@x.com`, password: 'pw', email_confirm: true })).data.user!
    const { data: ev } = await admin.from('events').insert({
      organizer_id: organizer.id, title: 'evt', city: '台北市', district: '大安區',
      start_at: new Date(Date.now()+86400000).toISOString(),
      end_at: new Date(Date.now()+90000000).toISOString(), status: 'published', capacity: 1,
    }).select('id').single()
    const email = `w-${crypto.randomUUID()}@x.com`
    await admin.auth.admin.createUser({ email, password: 'pw', email_confirm: true })
    // 先塞一個 registered 佔位
    const filler = (await admin.auth.admin.createUser({ email: `f-${crypto.randomUUID()}@x.com`, password: 'pw', email_confirm: true })).data.user!
    await admin.from('registrations').insert({ event_id: ev!.id, user_id: filler.id, status: 'registered' })
    const c = createClient(url!, anon!)
    await c.auth.signInWithPassword({ email, password: 'pw' })
    await c.rpc('register_for_event', { p_event_id: ev!.id }) // 進候補
    const { data } = await c.rpc('get_my_registration', { p_event_id: ev!.id })
    expect(data![0].status).toBe('waitlist')
    expect(data![0].waitlist_position).toBe(1)
  })
})
```

- [ ] **Step 4: 執行測試**

Run（帶環境變數）: `npm test tests/db/registration-reads.test.ts`
Expected: 2 passed。裸 `npm test` 全綠。

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0007_registration_reads.sql tests/db/registration-reads.test.ts
git commit -m "feat: registered-count view and my-registration function"
```

---

## Task 4: 純邏輯 — parseRegistrationFields

**Files:**
- Create: `lib/events/registration-logic.ts`
- Create: `tests/events/registration-logic.test.ts`

- [ ] **Step 1: 寫失敗測試**

Create `tests/events/registration-logic.test.ts`:
```ts
import { expect, test } from 'vitest'
import { parseRegistrationFields } from '@/lib/events/registration-logic'

test('預設全部 off 時無欄位', () => {
  expect(parseRegistrationFields({})).toEqual([])
})
test('解析 required / optional，忽略 off', () => {
  const fields = parseRegistrationFields({ party_size: 'optional', phone: 'required', note: 'off' })
  expect(fields).toEqual([
    { key: 'party_size', label: '同行人數', required: false },
    { key: 'phone', label: '聯絡電話', required: true },
  ])
})
```
Run: `npm test tests/events/registration-logic.test.ts` → FAIL。

- [ ] **Step 2: 實作**

Create `lib/events/registration-logic.ts`:
```ts
export type FieldSetting = 'off' | 'optional' | 'required'
export interface RegistrationFieldConfig {
  party_size?: FieldSetting
  phone?: FieldSetting
  note?: FieldSetting
}
export interface RegistrationField {
  key: 'party_size' | 'phone' | 'note'
  label: string
  required: boolean
}

const LABELS: Record<RegistrationField['key'], string> = {
  party_size: '同行人數',
  phone: '聯絡電話',
  note: '備註',
}
const ORDER: RegistrationField['key'][] = ['party_size', 'phone', 'note']

export function parseRegistrationFields(config: RegistrationFieldConfig): RegistrationField[] {
  return ORDER.flatMap((key) => {
    const setting = config[key]
    if (setting !== 'optional' && setting !== 'required') return []
    return [{ key, label: LABELS[key], required: setting === 'required' }]
  })
}
```
Run: `npm test tests/events/registration-logic.test.ts` → PASS。

- [ ] **Step 3: Commit**

```bash
git add lib/events/registration-logic.ts tests/events/registration-logic.test.ts
git commit -m "feat: parseRegistrationFields helper"
```

---

## Task 5: 型別 + server actions + 讀取面併入

**Files:**
- Modify: `lib/types.ts`
- Create: `lib/events/registration.ts`
- Modify: `lib/events/queries.ts`

- [ ] **Step 1: 擴充型別**

Add to `lib/types.ts`:
```ts
export interface MyRegistration {
  status: 'registered' | 'waitlist'
  waitlistPosition: number | null
}
```
並在 `EventSummary` 介面加入 `registeredCount: number`，在 `EventDetail` 介面加入 `registeredCount: number` 與 `myRegistration: MyRegistration | null`。（`capacity` 已存在。）

- [ ] **Step 2: server actions**

Create `lib/events/registration.ts`:
```ts
'use server'
import { createClient } from '@/lib/supabase/server'

export async function register(
  eventId: string,
  input: { partySize?: number; formAnswers?: Record<string, string> },
) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('register_for_event', {
    p_event_id: eventId,
    p_party_size: input.partySize ?? 1,
    p_form_answers: input.formAnswers ?? {},
  })
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const, status: data as 'registered' | 'waitlist' }
}

export async function cancelRegistration(eventId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('cancel_registration', { p_event_id: eventId })
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const, promotedUserId: (data as string | null) ?? null }
}
```

- [ ] **Step 3: 讀取面併入計數與本人狀態**

修改 `lib/events/queries.ts`：
- `getEventById` 於取得活動後，額外查：
```ts
  const [{ data: countRow }, { data: myReg }] = await Promise.all([
    supabase.from('event_registered_counts').select('registered_count').eq('event_id', id).maybeSingle(),
    supabase.rpc('get_my_registration', { p_event_id: id }),
  ])
  const registeredCount = countRow?.registered_count ?? 0
  const my = Array.isArray(myReg) && myReg[0]
    ? { status: myReg[0].status as 'registered' | 'waitlist', waitlistPosition: myReg[0].waitlist_position ?? null }
    : null
```
  並把 `registeredCount` 與 `myRegistration: my` 併入回傳的 `EventDetail`。
- `listPublishedEvents`：取得 events 後，用其 id 批次查計數併入每筆 `registeredCount`：
```ts
  const ids = events.map(e => e.id)
  const { data: counts } = ids.length
    ? await supabase.from('event_registered_counts').select('event_id, registered_count').in('event_id', ids)
    : { data: [] as { event_id: string; registered_count: number }[] }
  const countMap = new Map((counts ?? []).map(c => [c.event_id, c.registered_count]))
  return events.map(e => ({ ...e, registeredCount: countMap.get(e.id) ?? 0 }))
```
  對應調整 `mapEventRow`/回傳型別，使 `EventSummary` 帶 `registeredCount`（預設 0）。

- [ ] **Step 4: 驗證**

Run: `npx tsc --noEmit`（零新錯誤）、`npm run build`（成功）、裸 `npm test`（全綠）。

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/events/registration.ts lib/events/queries.ts
git commit -m "feat: registration server actions and read-side counts"
```

---

## Task 6: 詳情頁報名狀態機 UI

**Files:**
- Create: `components/RegistrationPanel.tsx`
- Modify: `app/events/[id]/page.tsx`
- Create: `tests/components/RegistrationPanel.test.tsx`

- [ ] **Step 1: 元件測試（各狀態顯示）**

Create `tests/components/RegistrationPanel.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { RegistrationPanel } from '@/components/RegistrationPanel'

const base = {
  eventId: 'e1', capacity: 10, registeredCount: 3,
  fields: [], startAt: new Date(Date.now()+86400000).toISOString(),
  registrationDeadline: null as string | null,
}

test('未登入顯示登入提示', () => {
  render(<RegistrationPanel {...base} isLoggedIn={false} myRegistration={null} />)
  expect(screen.getByText(/登入後報名/)).toBeInTheDocument()
})
test('已報名顯示取消', () => {
  render(<RegistrationPanel {...base} isLoggedIn={true} myRegistration={{ status:'registered', waitlistPosition:null }} />)
  expect(screen.getByText(/已報名/)).toBeInTheDocument()
  expect(screen.getByText(/取消報名/)).toBeInTheDocument()
})
test('額滿且未報名顯示加入候補', () => {
  render(<RegistrationPanel {...base} registeredCount={10} isLoggedIn={true} myRegistration={null} />)
  expect(screen.getByText(/已額滿/)).toBeInTheDocument()
})
test('候補中顯示序位', () => {
  render(<RegistrationPanel {...base} registeredCount={10} isLoggedIn={true} myRegistration={{ status:'waitlist', waitlistPosition:2 }} />)
  expect(screen.getByText(/第 2 位/)).toBeInTheDocument()
})
```
Run → FAIL。

- [ ] **Step 2: 實作 RegistrationPanel**

Create `components/RegistrationPanel.tsx`:
```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { register, cancelRegistration } from '@/lib/events/registration'
import { Button } from '@/components/ui/Button'
import type { RegistrationField } from '@/lib/events/registration-logic'
import type { MyRegistration } from '@/lib/types'

export function RegistrationPanel(props: {
  eventId: string
  capacity: number | null
  registeredCount: number
  fields: RegistrationField[]
  startAt: string
  registrationDeadline: string | null
  isLoggedIn: boolean
  myRegistration: MyRegistration | null
}) {
  const { eventId, capacity, registeredCount, fields, startAt, registrationDeadline, isLoggedIn, myRegistration } = props
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const now = Date.now()
  const started = new Date(startAt).getTime() <= now
  const closed = registrationDeadline ? new Date(registrationDeadline).getTime() <= now : false
  const full = capacity !== null && registeredCount >= capacity

  const login = () => {
    const supabase = createClient()
    supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}/auth/callback` } })
  }
  async function doRegister(formData: FormData) {
    setBusy(true); setError(null)
    const answers: Record<string, string> = {}
    let partySize = 1
    for (const f of fields) {
      const v = String(formData.get(f.key) ?? '')
      if (f.key === 'party_size') partySize = Number(v) || 1
      else if (v) answers[f.key] = v
    }
    const res = await register(eventId, { partySize, formAnswers: answers })
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    router.refresh()
  }
  async function doCancel() {
    setBusy(true); setError(null)
    const res = await cancelRegistration(eventId)
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    router.refresh()
  }

  const box = 'rounded-card border border-hairline bg-card p-5'

  if (started) return <div className={box}><p className="text-secondary">活動已開始或結束</p></div>
  if (!isLoggedIn) return <div className={box}><Button onClick={login}>登入後報名</Button></div>

  if (myRegistration?.status === 'registered')
    return <div className={box}><p className="mb-3 font-semibold text-accent">✓ 已報名</p>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <Button variant="ghost" disabled={busy} onClick={doCancel}>取消報名</Button></div>
  if (myRegistration?.status === 'waitlist')
    return <div className={box}><p className="mb-3 font-semibold">候補中（第 {myRegistration.waitlistPosition} 位）</p>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <Button variant="ghost" disabled={busy} onClick={doCancel}>取消候補</Button></div>
  if (closed) return <div className={box}><Button disabled>報名已截止</Button></div>

  return (
    <form action={doRegister} className={box}>
      {full && <p className="mb-2 text-sm text-secondary">此活動已額滿，報名將加入候補。</p>}
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {fields.map(f => (
        <label key={f.key} className="mb-2 block text-sm">
          {f.label}{f.required && ' *'}
          <input name={f.key} required={f.required}
            type={f.key === 'party_size' ? 'number' : 'text'}
            defaultValue={f.key === 'party_size' ? 1 : ''}
            className="mt-1 w-full rounded-lg border border-hairline bg-card px-3 py-1.5" />
        </label>
      ))}
      <Button type="submit" disabled={busy}>{full ? '加入候補' : '我要報名'}</Button>
    </form>
  )
}
```

- [ ] **Step 3: 執行測試**

Run: `npm test tests/components/RegistrationPanel.test.tsx` → PASS（4）。

- [ ] **Step 4: 崁入詳情頁**

修改 `app/events/[id]/page.tsx`：取得使用者登入狀態與 `parseRegistrationFields`，在 article 內加入面板。於檔案頂部 import：
```tsx
import { RegistrationPanel } from '@/components/RegistrationPanel'
import { parseRegistrationFields } from '@/lib/events/registration-logic'
import { createClient } from '@/lib/supabase/server'
```
在取得 `ev` 後：
```tsx
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: rawEvent } = await supabase.from('events').select('registration_fields').eq('id', id).single()
  const fields = parseRegistrationFields((rawEvent?.registration_fields ?? {}))
```
並在描述上方插入：
```tsx
  <div className="my-6">
    <RegistrationPanel
      eventId={ev.id}
      capacity={ev.capacity}
      registeredCount={ev.registeredCount}
      fields={fields}
      startAt={ev.startAt}
      registrationDeadline={ev.registrationDeadline}
      isLoggedIn={Boolean(user)}
      myRegistration={ev.myRegistration}
    />
  </div>
```
> 註：`EventDetail` 需含 `capacity`。若 Task 5 未在 `EventDetail` 帶 `capacity`，於 `getEventById` 的 select 與回傳補上 `capacity`。

- [ ] **Step 5: 驗證**

Run: `npx tsc --noEmit`（零新錯誤）、`npm run build`（成功）、裸 `npm test`（全綠）。

- [ ] **Step 6: Commit**

```bash
git add components/RegistrationPanel.tsx app/events/[id]/page.tsx tests/components/RegistrationPanel.test.tsx
git commit -m "feat: registration panel state machine on event detail"
```

---

## Task 7: 主辦方 registration_fields 開關

**Files:**
- Modify: `components/EventForm.tsx`
- Modify: `lib/events/actions.ts`
- Modify: `lib/events/mutations.ts`（`EventInput` 加欄位）

- [ ] **Step 1: 擴充 EventInput**

在 `lib/events/mutations.ts` 的 `EventInput` 介面加入：
```ts
  registrationFields?: { party_size?: string; phone?: string; note?: string }
```

- [ ] **Step 2: createEvent 寫入 registration_fields**

在 `lib/events/actions.ts` 的 `createEvent` insert 物件加入：
```ts
    registration_fields: input.registrationFields ?? {},
```

- [ ] **Step 3: 表單加開關**

在 `components/EventForm.tsx` 的送出前組出 `registrationFields`，並在表單加入三組下拉（各 關/選填/必填）。於 `action` 內：
```tsx
    const fieldSetting = (k: string) => String(formData.get(`rf_${k}`) ?? 'off')
    // ...傳入 createEvent 的物件加：
    registrationFields: {
      party_size: fieldSetting('party_size'),
      phone: fieldSetting('phone'),
      note: fieldSetting('note'),
    },
```
並在表單 JSX（送出按鈕前）加入：
```tsx
      <fieldset className="rounded-lg border border-hairline p-3">
        <legend className="px-1 text-sm text-secondary">報名要收集的欄位</legend>
        {[['party_size','同行人數'],['phone','聯絡電話'],['note','備註']].map(([k,label]) => (
          <label key={k} className="flex items-center justify-between py-1 text-sm">
            {label}
            <select name={`rf_${k}`} defaultValue="off" className="rounded border border-hairline px-2 py-1">
              <option value="off">不收集</option>
              <option value="optional">選填</option>
              <option value="required">必填</option>
            </select>
          </label>
        ))}
      </fieldset>
```

- [ ] **Step 4: 驗證**

Run: `npx tsc --noEmit`（零新錯誤）、`npm run build`（成功）、裸 `npm test`（全綠）。手動確認：發布一個活動時可設定欄位，詳情頁報名區出現對應欄位。

- [ ] **Step 5: Commit**

```bash
git add components/EventForm.tsx lib/events/actions.ts lib/events/mutations.ts
git commit -m "feat: organizer registration field toggles"
```

---

## 完成後的可運作成果

- 會員在詳情頁報名；額滿自動候補、顯示候補序位；活動開始前可取消，取消 registered 自動遞補。
- 併發搶名額由 RPC 行鎖保證只有一人成功。
- 卡片/詳情顯示「剩 N 位 / 已額滿」。
- 主辦方發布時可設定報名欄位；報名者依設定填寫。
- 名單隱私由 RLS 於資料庫層把關。

## 下一步（各自另出計畫）
- **2c** 主辦方後台 + 報名名單 CSV 匯出（RLS 已就緒）。
- **2d** 站內通知（`cancel_registration` 已回傳被遞補者 id 供接線）。
- **2b** 收藏、**2e** Banner、**2f** 排程。
