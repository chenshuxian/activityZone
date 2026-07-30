# 階段 2c · 主辦方後台 + 報名名單匯出 · 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 主辦方在 `/dashboard` 管理自己的活動、編輯內容（狀態受保護）、檢視與匯出報名名單 CSV。

**Architecture:** 編輯權限放寬 + 資料庫 trigger 治理 status；名單經「僅主辦方/admin 可呼叫」的 SECURITY DEFINER 函式提供（含 email）；Server actions/queries 薄封裝；UI 沿用設計系統；CSV 由純函式產生、route handler 下載。

**Tech Stack:** Next.js 15、Supabase（RLS、trigger、RPC）、Vitest（單元 + 本機 DB 整合）、既有 `components/ui` 與色彩 token。

**Scope:** 對應 spec `docs/superpowers/specs/2026-07-30-phase2c-organizer-dashboard-design.md`。不含通知（2d）。既有 migration 0001–0007；本計畫新增 0008。

本機 Supabase（Docker）：API `http://127.0.0.1:54321`。整合測試以環境變數 `SUPABASE_TEST_URL` / `SUPABASE_TEST_ANON_KEY` / `SUPABASE_TEST_SERVICE_KEY` 傳入本機 anon / service key。簽入使用者的測試 client 一律加 `{ auth: { persistSession: false, autoRefreshToken: false } }`（避免 supabase-js 記憶體 session 互相覆蓋）。

---

## File Structure

- `supabase/migrations/0008_organizer_dashboard.sql` — 放寬 events_update RLS、guard_event_status trigger、get_event_registrations 函式。
- `lib/database.types.ts` — 重新產生（新函式）。
- `lib/events/actions.ts` — 新增 `updateEvent`（修改）。
- `lib/events/dashboard.ts` — `getMyEvents`、`getEventForEdit`（新）。
- `lib/events/registrations-admin.ts` — `getEventRegistrations`（server，呼叫 RPC）（新）。
- `lib/events/csv.ts` — `toRegistrationsCsv` 純函式（新）。
- `lib/types.ts` — 新增 dashboard/名單型別（修改）。
- `components/StatusBadge.tsx` — 活動狀態徽章（新）。
- `components/EventForm.tsx` — 加編輯模式（修改）。
- `app/dashboard/page.tsx` — 後台（新）。
- `app/events/[id]/edit/page.tsx` — 編輯頁（新）。
- `app/events/[id]/registrations/page.tsx` — 名單頁（新）。
- `app/events/[id]/registrations/export/route.ts` — CSV 下載（新）。
- `components/Header.tsx` — 加「我的活動」連結（修改）。
- 測試置於 `tests/`。

---

## Task 1: migration 0008（RLS + trigger + 名單函式）

**Files:**
- Create: `supabase/migrations/0008_organizer_dashboard.sql`
- Modify: `lib/database.types.ts`（重新產生）
- Create: `tests/db/dashboard-guard.test.ts`

- [ ] **Step 1: 寫 migration**

Create `supabase/migrations/0008_organizer_dashboard.sql`:
```sql
-- 放寬編輯：主辦方可更新自己活動的內容（不論狀態）；status 由下方 trigger 治理
drop policy if exists events_update on public.events;
create policy events_update on public.events
  for update using (organizer_id = auth.uid() or public.is_admin())
  with check (organizer_id = auth.uid() or public.is_admin());

-- 狀態守門：非 admin 不得變更 status，唯一例外 rejected -> pending（重新送審）
create or replace function public.guard_event_status() returns trigger
language plpgsql security definer as $$
begin
  if public.is_admin() then return new; end if;
  if new.status is distinct from old.status then
    if not (old.status = 'rejected' and new.status = 'pending') then
      raise exception 'not allowed to change event status';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists events_guard_status on public.events;
create trigger events_guard_status
  before update on public.events
  for each row execute function public.guard_event_status();

-- 報名名單（僅該活動主辦方/admin 可呼叫）
create or replace function public.get_event_registrations(p_event_id uuid)
returns table (
  user_id uuid, display_name text, email text, status text,
  party_size int, form_answers jsonb, created_at timestamptz
)
language plpgsql security definer as $$
begin
  if not exists (
    select 1 from public.events e
    where e.id = p_event_id and (e.organizer_id = auth.uid() or public.is_admin())
  ) then
    raise exception 'not authorized';
  end if;
  return query
    select r.user_id, p.display_name, u.email::text, r.status,
           r.party_size, r.form_answers, r.created_at
    from public.registrations r
    join public.profiles p on p.id = r.user_id
    left join auth.users u on u.id = r.user_id
    where r.event_id = p_event_id and r.status <> 'cancelled'
    order by (r.status = 'waitlist'), r.created_at;
end; $$;
grant execute on function public.get_event_registrations(uuid) to authenticated;
```

- [ ] **Step 2: 套用 + 重新產生型別**

Run:
```bash
npx supabase db reset
npx supabase gen types typescript --local > lib/database.types.ts
```
確認 `get_event_registrations` 出現在 `lib/database.types.ts` 的 Functions。

- [ ] **Step 3: 整合測試**

Create `tests/db/dashboard-guard.test.ts`:
```ts
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, test } from 'vitest'

const url = process.env.SUPABASE_TEST_URL
const anon = process.env.SUPABASE_TEST_ANON_KEY
const service = process.env.SUPABASE_TEST_SERVICE_KEY

async function signedInClient(admin: SupabaseClient, email: string) {
  await admin.auth.admin.createUser({ email, password: 'pw', email_confirm: true })
  const c = createClient(url!, anon!, { auth: { persistSession: false, autoRefreshToken: false } })
  await c.auth.signInWithPassword({ email, password: 'pw' })
  return c
}

describe.skipIf(!url || !anon || !service)('dashboard guard + registrations', () => {
  let admin: SupabaseClient
  beforeEach(() => { admin = createClient(url!, service!) })

  async function ownerWithEvent(status: string) {
    const email = `own-${crypto.randomUUID()}@x.com`
    const client = await signedInClient(admin, email)
    const uid = (await client.auth.getUser()).data.user!.id
    const { data: ev } = await admin.from('events').insert({
      organizer_id: uid, title: 'orig', city: '台北市', district: '大安區',
      start_at: new Date(Date.now()+86400000).toISOString(),
      end_at: new Date(Date.now()+90000000).toISOString(), status,
    }).select('id').single()
    return { client, uid, eventId: ev!.id as string }
  }

  test('主辦方可編輯已上架活動的內容', async () => {
    const { client, eventId } = await ownerWithEvent('published')
    const { error } = await client.from('events').update({ title: '新標題' }).eq('id', eventId)
    expect(error).toBeNull()
    const { data } = await admin.from('events').select('title').eq('id', eventId).single()
    expect(data!.title).toBe('新標題')
  })

  test('主辦方不能改自己活動的 status', async () => {
    const { client, eventId } = await ownerWithEvent('pending')
    const { error } = await client.from('events').update({ status: 'published' }).eq('id', eventId)
    expect(error).not.toBeNull()
    const { data } = await admin.from('events').select('status').eq('id', eventId).single()
    expect(data!.status).toBe('pending')
  })

  test('主辦方可將 rejected 重新送審為 pending', async () => {
    const { client, eventId } = await ownerWithEvent('rejected')
    const { error } = await client.from('events').update({ status: 'pending' }).eq('id', eventId)
    expect(error).toBeNull()
  })

  test('名單函式：主辦方可取得（含 email、正取先於候補），非主辦方被拒', async () => {
    const { client, eventId } = await ownerWithEvent('published')
    // 兩位報名者：先 registered 後 waitlist（用 service 直接塞，控制順序）
    const u1 = (await admin.auth.admin.createUser({ email: `r1-${crypto.randomUUID()}@x.com`, email_confirm: true })).data.user!
    const u2 = (await admin.auth.admin.createUser({ email: `r2-${crypto.randomUUID()}@x.com`, email_confirm: true })).data.user!
    await admin.from('registrations').insert({ event_id: eventId, user_id: u1.id, status: 'registered' })
    await admin.from('registrations').insert({ event_id: eventId, user_id: u2.id, status: 'waitlist' })

    const { data, error } = await client.rpc('get_event_registrations', { p_event_id: eventId })
    expect(error).toBeNull()
    expect(data!.length).toBe(2)
    expect(data![0].status).toBe('registered') // 正取先
    expect(String(data![0].email)).toContain('@')

    const outsider = await signedInClient(admin, `out-${crypto.randomUUID()}@x.com`)
    const denied = await outsider.rpc('get_event_registrations', { p_event_id: eventId })
    expect(denied.error).not.toBeNull()
  })
})
```

- [ ] **Step 4: 執行測試（含回歸）**

Run（帶三個環境變數）: `npm test tests/db/dashboard-guard.test.ts` → 4 passed。
**回歸檢查**：放寬 with-check 後，防自我上架改由 trigger 負責。務必帶環境變數跑**整個 DB 測試套件**確認既有 `tests/db/rls.test.ts`（主辦方不能自我 publish）仍通過：`npm test tests/db`（帶三個 env 變數）→ 全數 passed。再跑裸 `npm test` 確認全綠。

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0008_organizer_dashboard.sql lib/database.types.ts tests/db/dashboard-guard.test.ts
git commit -m "feat: dashboard RLS relax, status guard trigger, registrations function"
```

---

## Task 2: updateEvent + dashboard 查詢 + 型別

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/events/actions.ts`
- Create: `lib/events/dashboard.ts`

- [ ] **Step 1: 型別**

Add to `lib/types.ts`:
```ts
export interface DashboardEvent {
  id: string
  title: string
  status: EventStatus
  startAt: string
  capacity: number | null
  registeredCount: number
  waitlistCount: number
}
```

- [ ] **Step 2: updateEvent（server action）**

在 `lib/events/actions.ts` 新增（沿用既有 `EventInput` 與 `validateEventInput`；不寫 status）：
```ts
export async function updateEvent(eventId: string, input: EventInput) {
  const errors = validateEventInput(input)
  if (errors.length) return { ok: false as const, errors }
  const supabase = await createClient()
  const { error } = await supabase.from('events').update({
    title: input.title, description: input.description ?? null,
    city: input.city, district: input.district, address: input.address ?? null,
    start_at: input.startAt, end_at: input.endAt,
    is_free: input.isFree, fee_note: input.feeNote ?? null,
    organizer_name: input.organizerName ?? null, contact_info: input.contactInfo ?? null,
    capacity: input.capacity ?? null,
    registration_fields: input.registrationFields ?? {},
  }).eq('id', eventId)
  if (error) return { ok: false as const, errors: [error.message] }
  // 類別：全刪重插
  await supabase.from('event_categories').delete().eq('event_id', eventId)
  if (input.categoryIds.length) {
    await supabase.from('event_categories').insert(
      input.categoryIds.map(cid => ({ event_id: eventId, category_id: cid })))
  }
  return { ok: true as const }
}
```

- [ ] **Step 3: dashboard 查詢**

Create `lib/events/dashboard.ts`:
```ts
import { createClient } from '@/lib/supabase/server'
import type { DashboardEvent, EventStatus } from '@/lib/types'

export async function getMyEvents(): Promise<DashboardEvent[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data: events } = await supabase.from('events')
    .select('id, title, status, start_at, capacity')
    .eq('organizer_id', user.id)
    .order('start_at', { ascending: false })
  const list = events ?? []
  const ids = list.map(e => e.id)
  // 主辦方可讀自己活動的報名（RLS 允許），依 status 計數
  const { data: regs } = ids.length
    ? await supabase.from('registrations').select('event_id, status').in('event_id', ids)
    : { data: [] as { event_id: string; status: string }[] }
  const reg = regs ?? []
  const count = (id: string, s: string) => reg.filter(r => r.event_id === id && r.status === s).length
  return list.map(e => ({
    id: e.id, title: e.title, status: e.status as EventStatus,
    startAt: e.start_at, capacity: e.capacity,
    registeredCount: count(e.id, 'registered'),
    waitlistCount: count(e.id, 'waitlist'),
  }))
}

export async function getEventForEdit(eventId: string) {
  const supabase = await createClient()
  const { data } = await supabase.from('events')
    .select('*, event_categories(category_id)')
    .eq('id', eventId).maybeSingle()
  return data
}
```

- [ ] **Step 4: 驗證**

Run: `npx tsc --noEmit`（零新錯誤）、`npm run build`（成功）、裸 `npm test`（全綠）。

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/events/actions.ts lib/events/dashboard.ts
git commit -m "feat: updateEvent action and dashboard queries"
```

---

## Task 3: CSV 純函式 + 名單 server 封裝

**Files:**
- Create: `lib/events/csv.ts`
- Create: `tests/events/csv.test.ts`
- Create: `lib/events/registrations-admin.ts`
- Modify: `lib/types.ts`

- [ ] **Step 1: 型別**

Add to `lib/types.ts`:
```ts
export interface RegistrationRow {
  userId: string
  displayName: string | null
  email: string | null
  status: 'registered' | 'waitlist'
  partySize: number
  formAnswers: Record<string, string>
  createdAt: string
}
```

- [ ] **Step 2: CSV 純函式（TDD）**

Create failing test `tests/events/csv.test.ts`:
```ts
import { expect, test } from 'vitest'
import { toRegistrationsCsv } from '@/lib/events/csv'
import type { RegistrationRow } from '@/lib/types'

const rows: RegistrationRow[] = [
  { userId:'u1', displayName:'小明', email:'a@x.com', status:'registered', partySize:2, formAnswers:{ phone:'0912' }, createdAt:'2026-07-30T00:00:00Z' },
]

test('空名單只有表頭', () => {
  const csv = toRegistrationsCsv([])
  expect(csv.split('\n')[0]).toContain('狀態')
  expect(csv.trim().split('\n').length).toBe(1)
})
test('輸出一列並正確跳脫逗號/引號', () => {
  const csv = toRegistrationsCsv([{ ...rows[0], displayName:'王, "小"明' }])
  const line = csv.trim().split('\n')[1]
  expect(line).toContain('"王, ""小""明"')
  expect(line).toContain('a@x.com')
  expect(line).toContain('2') // party size
})
```
Run → FAIL。

- [ ] **Step 3: 實作 CSV**

Create `lib/events/csv.ts`:
```ts
import type { RegistrationRow } from '@/lib/types'

const HEADERS = ['狀態', '顯示名稱', 'Email', '同行人數', '額外欄位', '報名時間']

function esc(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

export function toRegistrationsCsv(rows: RegistrationRow[]): string {
  const lines = [HEADERS.join(',')]
  for (const r of rows) {
    const answers = Object.entries(r.formAnswers).map(([k, v]) => `${k}=${v}`).join('; ')
    lines.push([
      r.status === 'registered' ? '正取' : '候補',
      r.displayName ?? '',
      r.email ?? '',
      String(r.partySize),
      answers,
      r.createdAt,
    ].map(esc).join(','))
  }
  return lines.join('\n') + '\n'
}
```
Run → PASS。

- [ ] **Step 4: 名單 server 封裝**

Create `lib/events/registrations-admin.ts`:
```ts
import { createClient } from '@/lib/supabase/server'
import type { RegistrationRow } from '@/lib/types'

export async function getEventRegistrations(eventId: string): Promise<RegistrationRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_event_registrations', { p_event_id: eventId })
  if (error) throw error
  return (data ?? []).map((r) => ({
    userId: r.user_id,
    displayName: r.display_name ?? null,
    email: r.email ?? null,
    status: r.status as 'registered' | 'waitlist',
    partySize: r.party_size,
    formAnswers: (r.form_answers ?? {}) as Record<string, string>,
    createdAt: r.created_at,
  }))
}
```

- [ ] **Step 5: 驗證**

Run: `npm test tests/events/csv.test.ts`（PASS）、`npx tsc --noEmit`（零新錯誤）、裸 `npm test`（全綠）。

- [ ] **Step 6: Commit**

```bash
git add lib/events/csv.ts tests/events/csv.test.ts lib/events/registrations-admin.ts lib/types.ts
git commit -m "feat: registrations CSV formatter and server fetch"
```

---

## Task 4: `/dashboard` 後台頁 + 狀態徽章

**Files:**
- Create: `components/StatusBadge.tsx`
- Create: `tests/components/StatusBadge.test.tsx`
- Create: `app/dashboard/page.tsx`

- [ ] **Step 1: StatusBadge（TDD）**

Create failing test `tests/components/StatusBadge.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { StatusBadge } from '@/components/StatusBadge'

test('顯示中文狀態', () => {
  render(<StatusBadge status="pending" />)
  expect(screen.getByText('待審核')).toBeInTheDocument()
})
test('已上架顯示對應文字', () => {
  render(<StatusBadge status="published" />)
  expect(screen.getByText('已上架')).toBeInTheDocument()
})
```
Run → FAIL。

- [ ] **Step 2: 實作 StatusBadge**

Create `components/StatusBadge.tsx`:
```tsx
import type { EventStatus } from '@/lib/types'

const LABELS: Record<EventStatus, string> = {
  draft: '草稿', pending: '待審核', published: '已上架', rejected: '退回', ended: '已結束',
}
const TONE: Record<EventStatus, string> = {
  draft: 'bg-chip text-secondary',
  pending: 'bg-chip text-foreground',
  published: 'bg-accent text-on-accent',
  rejected: 'bg-chip text-red-600',
  ended: 'bg-chip text-secondary',
}

export function StatusBadge({ status }: { status: EventStatus }) {
  return (
    <span className={`inline-block rounded-pill px-2.5 py-0.5 text-xs ${TONE[status]}`}>
      {LABELS[status]}
    </span>
  )
}
```
Run → PASS。

- [ ] **Step 3: 後台頁**

Create `app/dashboard/page.tsx`:
```tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMyEvents } from '@/lib/events/dashboard'
import { StatusBadge } from '@/components/StatusBadge'
import { ButtonLink } from '@/components/ui/Button'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const events = await getMyEvents()
  return (
    <main className="mx-auto max-w-4xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight-a">我的活動</h1>
        <ButtonLink href="/events/new">發布活動</ButtonLink>
      </div>
      {events.length === 0 ? (
        <p className="text-secondary">你還沒有發布任何活動。</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {events.map(e => (
            <li key={e.id} className="rounded-card border border-hairline bg-card p-4">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{e.title}</span>
                <StatusBadge status={e.status} />
              </div>
              <div className="mt-1 text-sm text-secondary">
                {new Date(e.startAt).toLocaleDateString('zh-TW')} ·
                {' '}正取 {e.registeredCount}{e.capacity !== null ? ` / ${e.capacity}` : ''}
                {e.waitlistCount > 0 ? ` · 候補 ${e.waitlistCount}` : ''}
              </div>
              <div className="mt-3 flex gap-3 text-sm">
                <Link href={`/events/${e.id}/edit`} className="text-accent hover:underline">編輯</Link>
                <Link href={`/events/${e.id}/registrations`} className="text-accent hover:underline">報名名單</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
```

- [ ] **Step 4: 驗證**

Run: `npm test tests/components/StatusBadge.test.tsx`（PASS）、`npx tsc --noEmit`（零錯誤）、`npm run build`（成功）、裸 `npm test`（全綠）。

- [ ] **Step 5: Commit**

```bash
git add components/StatusBadge.tsx tests/components/StatusBadge.test.tsx app/dashboard/page.tsx
git commit -m "feat: organizer dashboard page with status badges"
```

---

## Task 5: EventForm 編輯模式 + 編輯頁

**Files:**
- Modify: `components/EventForm.tsx`
- Create: `app/events/[id]/edit/page.tsx`

- [ ] **Step 1: EventForm 支援編輯**

改 `components/EventForm.tsx`，讓它接受選用的 `initial` 與 `submitAction`，並向後相容（現有 `/events/new` 使用方式不變）。要點：
- 新增 props：
```ts
  initial?: {
    id: string
    title?: string; description?: string; city?: string; district?: string; address?: string
    startAt?: string; endAt?: string; capacity?: number | null; isFree?: boolean
    organizerName?: string; contactInfo?: string; categoryIds?: string[]
    registrationFields?: { party_size?: string; phone?: string; note?: string }
  }
  submitAction?: (input: EventInput) => Promise<{ ok: boolean; errors?: string[] }>
  submitLabel?: string
```
- `action(formData)` 內：組出 `EventInput` 後，呼叫 `submitAction ?? createEvent`；成功後：有 `initial?.id`（編輯）導向 `/dashboard`，否則維持原本導向 `/?submitted=1`。
- 各欄位以 `defaultValue={initial?.xxx}` 預填；city 的 `useState` 初始值用 `initial?.city ?? ''`；類別 checkbox 以 `defaultChecked={initial?.categoryIds?.includes(c.id)}`；`isFree` checkbox `defaultChecked={initial?.isFree ?? true}`；報名欄位 select 的 `defaultValue={initial?.registrationFields?.[k] ?? 'off'}`。
- 送出按鈕文字用 `submitLabel ?? '送出審核'`。

（若加入編輯模式使 `EventForm` 過大，可將欄位區塊抽為 `EventFormFields` 子元件；實作時判斷，但不改變對外行為。）

- [ ] **Step 2: 編輯頁**

Create `app/events/[id]/edit/page.tsx`:
```tsx
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEventForEdit } from '@/lib/events/dashboard'
import { updateEvent } from '@/lib/events/actions'
import { EventForm } from '@/components/EventForm'
import type { EventInput } from '@/lib/events/mutations'

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const ev = await getEventForEdit(id)  // RLS：非本人/admin 讀不到
  if (!ev) notFound()

  const { data: categories } = await supabase.from('categories').select('id,name,slug,icon')

  async function submit(input: EventInput) {
    'use server'
    return updateEvent(id, input)
  }

  const initial = {
    id,
    title: ev.title, description: ev.description ?? '',
    city: ev.city, district: ev.district, address: ev.address ?? '',
    startAt: toLocalInput(ev.start_at), endAt: toLocalInput(ev.end_at),
    capacity: ev.capacity, isFree: ev.is_free,
    organizerName: ev.organizer_name ?? '', contactInfo: ev.contact_info ?? '',
    categoryIds: (ev.event_categories ?? []).map((c: { category_id: string }) => c.category_id),
    registrationFields: (ev.registration_fields ?? {}) as { party_size?: string; phone?: string; note?: string },
  }
  return (
    <main>
      <EventForm categories={categories ?? []} initial={initial} submitAction={submit} submitLabel="儲存變更" />
    </main>
  )
}

// datetime-local 需 'YYYY-MM-DDTHH:mm'
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
```

- [ ] **Step 3: 驗證**

Run: `npx tsc --noEmit`（零錯誤）、`npm run build`（成功）、裸 `npm test`（全綠，含既有 EventForm 相關測試不被破壞）。手動：從 /dashboard 進編輯、改標題儲存、回後台看到更新。

- [ ] **Step 4: Commit**

```bash
git add components/EventForm.tsx app/events/[id]/edit/page.tsx
git commit -m "feat: event edit mode and edit page"
```

---

## Task 6: 名單頁 + CSV 匯出 route + Header 連結

**Files:**
- Create: `app/events/[id]/registrations/page.tsx`
- Create: `app/events/[id]/registrations/export/route.ts`
- Modify: `components/Header.tsx`

- [ ] **Step 1: 名單頁**

Create `app/events/[id]/registrations/page.tsx`:
```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEventRegistrations } from '@/lib/events/registrations-admin'

export default async function RegistrationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  let rows
  try { rows = await getEventRegistrations(id) }
  catch { redirect('/dashboard') } // 非主辦方 → 函式丟例外
  return (
    <main className="mx-auto max-w-4xl px-5 py-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight-a">報名名單（{rows.length}）</h1>
        <a href={`/events/${id}/registrations/export`}
           className="rounded-pill bg-accent px-4 py-2 text-sm font-medium text-on-accent">匯出 CSV</a>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline text-left text-secondary">
              <th className="py-2 pr-4">狀態</th><th className="py-2 pr-4">名稱</th>
              <th className="py-2 pr-4">Email</th><th className="py-2 pr-4">人數</th>
              <th className="py-2 pr-4">額外</th><th className="py-2">報名時間</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.userId} className="border-b border-hairline">
                <td className="py-2 pr-4">{r.status === 'registered' ? '正取' : '候補'}</td>
                <td className="py-2 pr-4">{r.displayName}</td>
                <td className="py-2 pr-4">{r.email}</td>
                <td className="py-2 pr-4">{r.partySize}</td>
                <td className="py-2 pr-4">{Object.entries(r.formAnswers).map(([k,v]) => `${k}=${v}`).join('; ')}</td>
                <td className="py-2">{new Date(r.createdAt).toLocaleString('zh-TW')}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="py-4 text-secondary">目前沒有報名。</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: CSV route handler**

Create `app/events/[id]/registrations/export/route.ts`:
```ts
import { createClient } from '@/lib/supabase/server'
import { getEventRegistrations } from '@/lib/events/registrations-admin'
import { toRegistrationsCsv } from '@/lib/events/csv'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('unauthorized', { status: 401 })
  let rows
  try { rows = await getEventRegistrations(id) }
  catch { return new Response('forbidden', { status: 403 }) }
  const csv = '﻿' + toRegistrationsCsv(rows) // BOM 讓 Excel 正確辨識 UTF-8
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="registrations-${id}.csv"`,
    },
  })
}
```

- [ ] **Step 3: Header 加「我的活動」**

在 `components/Header.tsx` 的 nav，登入時多顯示一個連結到 `/dashboard`：於 `email` 有值時，在既有導覽區加入 `<Link href="/dashboard">我的活動</Link>`（沿用現有樣式 class）。維持未登入時不顯示。

- [ ] **Step 4: 驗證**

Run: `npx tsc --noEmit`（零錯誤）、`npm run build`（成功）、裸 `npm test`（全綠）。手動：以主辦方看名單、按匯出下載 CSV（Excel 開啟中文正常）；非主辦方連 `/events/[id]/registrations` 被導回 `/dashboard`。

- [ ] **Step 5: Commit**

```bash
git add "app/events/[id]/registrations/page.tsx" "app/events/[id]/registrations/export/route.ts" components/Header.tsx
git commit -m "feat: registrations list page, CSV export route, dashboard nav link"
```

---

## 完成後的可運作成果

- 主辦方在 `/dashboard` 看到自己所有活動（狀態、正取/候補計數），可編輯內容、看名單。
- 編輯已上架活動內容可行；改 status 被資料庫 trigger 擋（審核仍受控）。
- 報名名單含 email，僅主辦方/admin 可見；可匯出 UTF-8 CSV（Excel 友善）。

## 下一步（各自另出計畫）
- **2d** 站內通知（審核結果/遞補/即將開始）。
- **2b** 收藏、**2e** Banner、**2f** 排程。
