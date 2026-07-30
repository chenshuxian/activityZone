# 階段 2d · 站內通知 · 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 登入使用者在站內收到通知（報名成功、加入候補、候補遞補、審核通過/退回），由資料庫 trigger 自動產生，Header 鈴鐺顯示未讀數與列表。

**Architecture:** 通知由 registrations/events 上的 trigger 自動寫入 `notifications`（definer）；Server 層讀取與標記已讀；純函式產生中文訊息；Header 鈴鐺（client）顯示未讀徽章與下拉列表。

**Tech Stack:** Next.js 15、Supabase（RLS、trigger）、Vitest（單元 + 本機 DB 整合）、既有 `components/ui` 與色彩 token。

**Scope:** 對應 spec `docs/superpowers/specs/2026-07-30-phase2d-notifications-design.md`。不含「即將開始」（2f）、email/推播、realtime。既有 migration 0001–0008；新增 0009。

本機 Supabase：API `http://127.0.0.1:54321`。整合測試以環境變數 `SUPABASE_TEST_URL` / `SUPABASE_TEST_ANON_KEY` / `SUPABASE_TEST_SERVICE_KEY` 傳入本機 key。簽入使用者的測試 client 一律加 `{ auth: { persistSession: false, autoRefreshToken: false } }`。

**重要（測試審核通知）**：0008 的 `guard_event_status` trigger 會擋「非 admin」變更 events.status（連 service_role 也擋，因 trigger 不受 RLS 影響、且 service_role 的 `auth.uid()` 為 null → `is_admin()` false）。因此測試「審核通過/退回」通知時，必須用**已設為 admin 的使用者 client** 去更新狀態，才能同時通過守門並觸發通知。

---

## File Structure

- `supabase/migrations/0009_notifications.sql` — notifications 表 + RLS + grants + notify() 輔助 + 3 組 trigger。
- `lib/database.types.ts` — 重新產生（新表）。
- `lib/types.ts` — 通知型別（修改）。
- `lib/notifications-logic.ts` — `notificationMessage` 純函式（新）。
- `lib/notifications.ts` — server：getNotifications / getUnreadCount / markRead / markAllRead（新）。
- `components/NotificationBell.tsx` — 鈴鐺（client，新）。
- `components/Header.tsx` — 登入時渲染鈴鐺（修改）。
- 測試置於 `tests/`。

---

## Task 1: migration 0009（notifications 表 + trigger）

**Files:**
- Create: `supabase/migrations/0009_notifications.sql`
- Modify: `lib/database.types.ts`（重生）
- Create: `tests/db/notifications.test.ts`

- [ ] **Step 1: 寫 migration**

Create `supabase/migrations/0009_notifications.sql`:
```sql
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('registered','waitlisted','promoted','moderation_approved','moderation_rejected')),
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;
create policy notifications_read on public.notifications for select using (user_id = auth.uid());
create policy notifications_update on public.notifications for update using (user_id = auth.uid());
grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;

-- 輔助：帶入活動標題快照寫入一則通知
create or replace function public.notify(p_user uuid, p_type text, p_event uuid, p_reason text default null)
returns void language plpgsql security definer as $$
declare v_title text;
begin
  select title into v_title from public.events where id = p_event;
  insert into public.notifications (user_id, type, payload)
  values (p_user, p_type,
    jsonb_build_object('eventId', p_event, 'eventTitle', coalesce(v_title,''))
      || case when p_reason is not null then jsonb_build_object('reason', p_reason) else '{}'::jsonb end);
end; $$;

-- registrations 新增 → 報名成功 / 加入候補
create or replace function public.notify_on_registration_insert() returns trigger
language plpgsql security definer as $$
begin
  if new.status = 'registered' then perform public.notify(new.user_id,'registered',new.event_id);
  elsif new.status = 'waitlist' then perform public.notify(new.user_id,'waitlisted',new.event_id);
  end if;
  return new;
end; $$;
create trigger notifications_on_registration_insert
  after insert on public.registrations for each row execute function public.notify_on_registration_insert();

-- registrations 更新 waitlist→registered → 候補遞補成功
create or replace function public.notify_on_registration_update() returns trigger
language plpgsql security definer as $$
begin
  if old.status = 'waitlist' and new.status = 'registered' then
    perform public.notify(new.user_id,'promoted',new.event_id);
  end if;
  return new;
end; $$;
create trigger notifications_on_registration_update
  after update on public.registrations for each row execute function public.notify_on_registration_update();

-- events 更新 → 審核通過 / 退回（通知主辦方）
create or replace function public.notify_on_event_moderation() returns trigger
language plpgsql security definer as $$
begin
  if old.status = 'pending' and new.status = 'published' then
    perform public.notify(new.organizer_id,'moderation_approved',new.id);
  elsif new.status = 'rejected' and old.status is distinct from 'rejected' then
    perform public.notify(new.organizer_id,'moderation_rejected',new.id,new.reject_reason);
  end if;
  return new;
end; $$;
create trigger notifications_on_event_moderation
  after update on public.events for each row execute function public.notify_on_event_moderation();
```

- [ ] **Step 2: 套用 + 重生型別**

Run:
```bash
npx supabase db reset
npx supabase gen types typescript --local > lib/database.types.ts
```
確認 `notifications` 出現在 `lib/database.types.ts` Tables。

- [ ] **Step 3: 整合測試**

Create `tests/db/notifications.test.ts`:
```ts
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, test } from 'vitest'

const url = process.env.SUPABASE_TEST_URL
const anon = process.env.SUPABASE_TEST_ANON_KEY
const service = process.env.SUPABASE_TEST_SERVICE_KEY

async function makeUser(admin: SupabaseClient) {
  const u = (await admin.auth.admin.createUser({ email: `u-${crypto.randomUUID()}@x.com`, email_confirm: true })).data.user!
  return u.id
}
async function makeAdminClient(admin: SupabaseClient) {
  const email = `a-${crypto.randomUUID()}@x.com`
  const u = (await admin.auth.admin.createUser({ email, password: 'pw', email_confirm: true })).data.user!
  await admin.from('profiles').update({ role: 'admin' }).eq('id', u.id)
  const c = createClient(url!, anon!, { auth: { persistSession: false, autoRefreshToken: false } })
  await c.auth.signInWithPassword({ email, password: 'pw' })
  return { client: c, id: u.id }
}
async function makeEvent(admin: SupabaseClient, organizerId: string, status: string) {
  const { data } = await admin.from('events').insert({
    organizer_id: organizerId, title: '通知測試活動', city: '台北市', district: '大安區',
    start_at: new Date(Date.now()+86400000).toISOString(),
    end_at: new Date(Date.now()+90000000).toISOString(), status,
  }).select('id').single()
  return data!.id as string
}

describe.skipIf(!url || !anon || !service)('notifications triggers', () => {
  let admin: SupabaseClient
  beforeEach(() => { admin = createClient(url!, service!) })

  test('報名 registered → 產生 registered 通知', async () => {
    const organizer = await makeUser(admin)
    const eventId = await makeEvent(admin, organizer, 'published')
    const uid = await makeUser(admin)
    await admin.from('registrations').insert({ event_id: eventId, user_id: uid, status: 'registered' })
    const { data } = await admin.from('notifications').select('type, payload').eq('user_id', uid)
    expect(data!.length).toBe(1)
    expect(data![0].type).toBe('registered')
    expect((data![0].payload as { eventTitle: string }).eventTitle).toBe('通知測試活動')
  })

  test('候補遞補：waitlist→registered → promoted 通知', async () => {
    const organizer = await makeUser(admin)
    const eventId = await makeEvent(admin, organizer, 'published')
    const uid = await makeUser(admin)
    const { data: reg } = await admin.from('registrations')
      .insert({ event_id: eventId, user_id: uid, status: 'waitlist' }).select('id').single()
    await admin.from('registrations').update({ status: 'registered' }).eq('id', reg!.id)
    const { data } = await admin.from('notifications').select('type').eq('user_id', uid).order('created_at')
    // 兩則：waitlisted（insert）+ promoted（update）
    expect(data!.map(d => d.type)).toEqual(['waitlisted', 'promoted'])
  })

  test('審核通過 → 主辦方收到 moderation_approved（需 admin 更新狀態）', async () => {
    const { client: adminClient } = await makeAdminClient(admin)
    const organizer = await makeUser(admin)
    const eventId = await makeEvent(admin, organizer, 'pending')
    await adminClient.from('events').update({ status: 'published' }).eq('id', eventId)
    const { data } = await admin.from('notifications').select('type').eq('user_id', organizer)
    expect(data!.map(d => d.type)).toContain('moderation_approved')
  })

  test('退回 → 主辦方收到 moderation_rejected 含原因', async () => {
    const { client: adminClient } = await makeAdminClient(admin)
    const organizer = await makeUser(admin)
    const eventId = await makeEvent(admin, organizer, 'pending')
    await adminClient.from('events').update({ status: 'rejected', reject_reason: '資訊不足' }).eq('id', eventId)
    const { data } = await admin.from('notifications').select('type, payload').eq('user_id', organizer)
    const rej = data!.find(d => d.type === 'moderation_rejected')
    expect(rej).toBeTruthy()
    expect((rej!.payload as { reason: string }).reason).toBe('資訊不足')
  })

  test('RLS：使用者只讀得到自己的通知', async () => {
    const organizer = await makeUser(admin)
    const eventId = await makeEvent(admin, organizer, 'published')
    const uid = await makeUser(admin)
    await admin.from('registrations').insert({ event_id: eventId, user_id: uid, status: 'registered' })
    // 另一個使用者登入後讀不到 uid 的通知
    const email = `o-${crypto.randomUUID()}@x.com`
    await admin.auth.admin.createUser({ email, password: 'pw', email_confirm: true })
    const other = createClient(url!, anon!, { auth: { persistSession: false, autoRefreshToken: false } })
    await other.auth.signInWithPassword({ email, password: 'pw' })
    const { data } = await other.from('notifications').select('id').eq('user_id', uid)
    expect(data).toEqual([])
  })
})
```

- [ ] **Step 4: 執行測試**

Run（帶三個環境變數）: `npm test tests/db/notifications.test.ts` → 5 passed。
帶 env 跑整個 `npm test tests/db` 確認無回歸。裸 `npm test` 全綠。

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0009_notifications.sql lib/database.types.ts tests/db/notifications.test.ts
git commit -m "feat: notifications table and triggers"
```

---

## Task 2: 型別 + notificationMessage 純函式

**Files:**
- Modify: `lib/types.ts`
- Create: `lib/notifications-logic.ts`
- Create: `tests/notifications/message.test.ts`

- [ ] **Step 1: 型別**

Add to `lib/types.ts`:
```ts
export type NotificationType =
  | 'registered' | 'waitlisted' | 'promoted' | 'moderation_approved' | 'moderation_rejected'

export interface NotificationPayload {
  eventId: string
  eventTitle: string
  reason?: string
}

export interface NotificationItem {
  id: string
  type: NotificationType
  payload: NotificationPayload
  readAt: string | null
  createdAt: string
}
```

- [ ] **Step 2: 失敗測試**

Create `tests/notifications/message.test.ts`:
```ts
import { expect, test } from 'vitest'
import { notificationMessage } from '@/lib/notifications-logic'

const p = { eventId: 'e1', eventTitle: '晨跑' }

test('各類型訊息', () => {
  expect(notificationMessage('registered', p)).toBe('報名成功：晨跑')
  expect(notificationMessage('waitlisted', p)).toBe('已加入候補：晨跑')
  expect(notificationMessage('promoted', p)).toBe('候補遞補成功：晨跑')
  expect(notificationMessage('moderation_approved', p)).toBe('活動已通過審核：晨跑')
})
test('退回含原因', () => {
  expect(notificationMessage('moderation_rejected', { ...p, reason: '資訊不足' }))
    .toBe('活動被退回：晨跑（資訊不足）')
})
test('退回無原因', () => {
  expect(notificationMessage('moderation_rejected', p)).toBe('活動被退回：晨跑')
})
```
Run → FAIL。

- [ ] **Step 3: 實作**

Create `lib/notifications-logic.ts`:
```ts
import type { NotificationType, NotificationPayload } from '@/lib/types'

export function notificationMessage(type: NotificationType, payload: NotificationPayload): string {
  const t = payload.eventTitle
  switch (type) {
    case 'registered': return `報名成功：${t}`
    case 'waitlisted': return `已加入候補：${t}`
    case 'promoted': return `候補遞補成功：${t}`
    case 'moderation_approved': return `活動已通過審核：${t}`
    case 'moderation_rejected': return `活動被退回：${t}${payload.reason ? `（${payload.reason}）` : ''}`
  }
}
```
Run → PASS。

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts lib/notifications-logic.ts tests/notifications/message.test.ts
git commit -m "feat: notification types and message formatter"
```

---

## Task 3: Server 層（讀取 + 標記已讀）

**Files:**
- Create: `lib/notifications.ts`

- [ ] **Step 1: 實作**

Create `lib/notifications.ts`:
```ts
'use server'
import { createClient } from '@/lib/supabase/server'
import type { NotificationItem, NotificationPayload, NotificationType } from '@/lib/types'

export async function getNotifications(limit = 20): Promise<NotificationItem[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('notifications')
    .select('id, type, payload, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []).map((n) => ({
    id: n.id,
    type: n.type as NotificationType,
    payload: (n.payload ?? {}) as NotificationPayload,
    readAt: n.read_at,
    createdAt: n.created_at,
  }))
}

export async function getUnreadCount(): Promise<number> {
  const supabase = await createClient()
  const { count } = await supabase.from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)
  return count ?? 0
}

export async function markRead(id: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
}

export async function markAllRead(): Promise<void> {
  const supabase = await createClient()
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
}
```
> RLS 已保證 select/update 僅限本人；不需在查詢再加 user 條件（`getNotifications`/`getUnreadCount` 隱含只回本人資料）。`'use server'` 讓 markRead/markAllRead 可被 client 元件呼叫。

- [ ] **Step 2: 驗證**

Run: `npx tsc --noEmit`（零新錯誤）、`npm run build`（成功）、裸 `npm test`（全綠）。

- [ ] **Step 3: Commit**

```bash
git add lib/notifications.ts
git commit -m "feat: notification server queries and mark-read actions"
```

---

## Task 4: Header 鈴鐺 UI

**Files:**
- Create: `components/NotificationBell.tsx`
- Create: `tests/components/NotificationBell.test.tsx`
- Modify: `components/Header.tsx`

- [ ] **Step 1: 元件測試**

Create `tests/components/NotificationBell.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { NotificationBellView } from '@/components/NotificationBell'
import type { NotificationItem } from '@/lib/types'

const items: NotificationItem[] = [
  { id: 'n1', type: 'registered', payload: { eventId: 'e1', eventTitle: '晨跑' }, readAt: null, createdAt: new Date().toISOString() },
]

test('未讀數徽章顯示', () => {
  render(<NotificationBellView items={items} unread={1} onOpen={()=>{}} onItemClick={()=>{}} onMarkAll={()=>{}} open={false} />)
  expect(screen.getByText('1')).toBeInTheDocument()
})
test('開啟面板列出通知訊息', () => {
  render(<NotificationBellView items={items} unread={1} onOpen={()=>{}} onItemClick={()=>{}} onMarkAll={()=>{}} open={true} />)
  expect(screen.getByText('報名成功：晨跑')).toBeInTheDocument()
})
test('點全部已讀觸發 callback', () => {
  const onMarkAll = vi.fn()
  render(<NotificationBellView items={items} unread={1} onOpen={()=>{}} onItemClick={()=>{}} onMarkAll={onMarkAll} open={true} />)
  fireEvent.click(screen.getByText('全部標為已讀'))
  expect(onMarkAll).toHaveBeenCalled()
})
```
Run → FAIL。

- [ ] **Step 2: 實作（分離純視圖 `NotificationBellView` 與容器 `NotificationBell`）**

Create `components/NotificationBell.tsx`:
```tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getNotifications, getUnreadCount, markRead, markAllRead } from '@/lib/notifications'
import { notificationMessage } from '@/lib/notifications-logic'
import type { NotificationItem } from '@/lib/types'

// 純視圖（可測試）
export function NotificationBellView(props: {
  items: NotificationItem[]
  unread: number
  open: boolean
  onOpen: () => void
  onItemClick: (n: NotificationItem) => void
  onMarkAll: () => void
}) {
  const { items, unread, open, onOpen, onItemClick, onMarkAll } = props
  return (
    <div className="relative">
      <button onClick={onOpen} className="relative cursor-pointer text-lg" aria-label="通知">
        🔔
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-pill bg-accent px-1 text-[10px] font-bold text-on-accent">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-50 w-72 overflow-hidden rounded-card border border-hairline bg-card shadow-card-hover">
          <div className="flex items-center justify-between border-b border-hairline px-3 py-2">
            <span className="text-sm font-medium">通知</span>
            <button onClick={onMarkAll} className="cursor-pointer text-xs text-accent">全部標為已讀</button>
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-secondary">目前沒有通知</li>}
            {items.map(n => (
              <li key={n.id}
                onClick={() => onItemClick(n)}
                className={`cursor-pointer border-b border-hairline px-3 py-2 text-sm last:border-b-0 hover:bg-surface ${n.readAt ? 'text-secondary' : 'font-medium'}`}>
                {notificationMessage(n.type, n.payload)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// 容器（接資料 + 行為）
export function NotificationBell() {
  const router = useRouter()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)

  async function refresh() {
    const [list, count] = await Promise.all([getNotifications(), getUnreadCount()])
    setItems(list); setUnread(count)
  }
  useEffect(() => { refresh() }, [])

  const onOpen = () => {
    const next = !open
    setOpen(next)
    if (next) refresh()
  }
  const onItemClick = async (n: NotificationItem) => {
    await markRead(n.id)
    setOpen(false)
    router.push(`/events/${n.payload.eventId}`)
  }
  const onMarkAll = async () => { await markAllRead(); await refresh() }

  return (
    <NotificationBellView items={items} unread={unread} open={open}
      onOpen={onOpen} onItemClick={onItemClick} onMarkAll={onMarkAll} />
  )
}
```
Run → PASS（3）。

- [ ] **Step 3: Header 渲染鈴鐺**

在 `components/Header.tsx`，登入時（`email` 有值）於登出鈕左側渲染 `<NotificationBell />`。import 之，並把右側區塊改為 flex 容器容納鈴鐺 + 登出鈕。未登入不顯示鈴鐺。

- [ ] **Step 4: 驗證**

Run: `npm test tests/components/NotificationBell.test.tsx`（3 passed）、`npx tsc --noEmit`（零錯誤）、`npm run build`（成功）、裸 `npm test`（全綠）。

- [ ] **Step 5: Commit**

```bash
git add components/NotificationBell.tsx tests/components/NotificationBell.test.tsx components/Header.tsx
git commit -m "feat: notification bell in header"
```

---

## 完成後的可運作成果

- 報名/候補/遞補/審核事件發生時，資料庫 trigger 自動產生對應通知。
- 登入使用者 Header 鈴鐺顯示未讀數；開面板看列表、點通知跳到活動並標為已讀、可全部已讀。
- 名單隱私：使用者只看得到自己的通知（RLS）。

## 下一步（各自另出計畫）
- **2f** 排程：過期轉 ended、活動即將開始通知（沿用本階段 notify 機制，type 加 `starting_soon`）。
- **2b** 收藏、**2e** Banner。
