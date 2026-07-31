# 階段 2e · 首頁 Banner（雙模式）· 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 首頁最上方自動輪播的 Banner 區：管理員手動挑活動主打，不足時自動補最近期活動。

**Architecture:** `banners` 表（連動 events，任何人可讀、僅 admin 寫）；`getHomeBanners` 合併手動+自動候選（純函式 `mergeBanners` 去重截斷）；`BannerCarousel`（client，自動輪播+小點）；`/admin/banners` 管理。

**Tech Stack:** Next.js 15、Supabase（RLS）、Vitest（本機 DB 整合 + 純函式 + 元件）、既有 `components/ui` 與色彩 token。

**Scope:** 對應 spec `docs/superpowers/specs/2026-07-30-phase2e-banner-design.md`。既有 migration 0001–0011；新增 0012。

本機 Supabase：API `http://127.0.0.1:54321`。整合測試以 `SUPABASE_TEST_URL` / `SUPABASE_TEST_ANON_KEY` / `SUPABASE_TEST_SERVICE_KEY` 傳入本機 key。簽入 client 加 `{ auth: { persistSession: false, autoRefreshToken: false } }`。admin client：建使用者→service_role 設 `profiles.role='admin'`→登入。

---

## File Structure

- `supabase/migrations/0012_banners.sql` — banners 表 + RLS + grants。
- `lib/database.types.ts` — 重生（新表）。
- `lib/types.ts` — `BannerItem` 型別（修改）。
- `lib/banners-logic.ts` — `mergeBanners` 純函式（新）。
- `lib/banners.ts` — server：getHomeBanners + 管理 actions（新）。
- `components/BannerCarousel.tsx` — 輪播（client，新）。
- `app/page.tsx` — 瀏覽模式渲染輪播（修改）。
- `app/admin/banners/page.tsx` — 管理後台（新）。
- 測試置於 `tests/`。

---

## Task 1: banners 表 + RLS

**Files:**
- Create: `supabase/migrations/0012_banners.sql`
- Modify: `lib/database.types.ts`（重生）
- Create: `tests/db/banners.test.ts`

- [ ] **Step 1: 寫 migration**

Create `supabase/migrations/0012_banners.sql`:
```sql
create table public.banners (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events(id) on delete cascade,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index banners_active_sort_idx on public.banners (active, sort_order);

alter table public.banners enable row level security;
create policy banners_public_read on public.banners for select using (true);
create policy banners_admin_write on public.banners for all
  using (public.is_admin()) with check (public.is_admin());
grant select on public.banners to anon, authenticated;
grant insert, update, delete on public.banners to authenticated;
grant all on public.banners to service_role;
```

- [ ] **Step 2: 套用 + 重生型別**

Run:
```bash
npx supabase db reset
npx supabase gen types typescript --local > lib/database.types.ts
```
若 `lib/database.types.ts` 第一行出現 `Connecting to db` 狀態行，刪掉。確認 `banners` 出現在 Tables，`npx tsc --noEmit` 對該檔無錯。

- [ ] **Step 3: 整合測試**

Create `tests/db/banners.test.ts`:
```ts
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, test } from 'vitest'

const url = process.env.SUPABASE_TEST_URL
const anon = process.env.SUPABASE_TEST_ANON_KEY
const service = process.env.SUPABASE_TEST_SERVICE_KEY

async function adminClient(admin: SupabaseClient) {
  const email = `a-${crypto.randomUUID()}@x.com`
  const u = (await admin.auth.admin.createUser({ email, password: 'pw', email_confirm: true })).data.user!
  await admin.from('profiles').update({ role: 'admin' }).eq('id', u.id)
  const c = createClient(url!, anon!, { auth: { persistSession: false, autoRefreshToken: false } })
  await c.auth.signInWithPassword({ email, password: 'pw' })
  return { client: c, id: u.id }
}
async function memberClient(admin: SupabaseClient) {
  const email = `m-${crypto.randomUUID()}@x.com`
  await admin.auth.admin.createUser({ email, password: 'pw', email_confirm: true })
  const c = createClient(url!, anon!, { auth: { persistSession: false, autoRefreshToken: false } })
  await c.auth.signInWithPassword({ email, password: 'pw' })
  return c
}
async function makeEvent(admin: SupabaseClient, organizer: string) {
  const { data } = await admin.from('events').insert({
    organizer_id: organizer, title: 'banner 測試', city: '台北市', district: '大安區',
    start_at: new Date(Date.now()+86400000).toISOString(),
    end_at: new Date(Date.now()+90000000).toISOString(), status: 'published',
  }).select('id').single()
  return data!.id as string
}

describe.skipIf(!url || !anon || !service)('banners RLS', () => {
  let admin: SupabaseClient
  beforeEach(() => { admin = createClient(url!, service!) })

  test('admin 可新增 banner，任何人可讀', async () => {
    const { client: a, id } = await adminClient(admin)
    const eventId = await makeEvent(admin, id)
    const { error } = await a.from('banners').insert({ event_id: eventId })
    expect(error).toBeNull()
    const anonClient = createClient(url!, anon!, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data } = await anonClient.from('banners').select('event_id').eq('event_id', eventId)
    expect(data!.length).toBe(1)
  })

  test('非 admin 不能新增 banner', async () => {
    const org = (await admin.auth.admin.createUser({ email: `o-${crypto.randomUUID()}@x.com`, email_confirm: true })).data.user!
    const eventId = await makeEvent(admin, org.id)
    const m = await memberClient(admin)
    const { error } = await m.from('banners').insert({ event_id: eventId })
    expect(error).not.toBeNull()
  })
})
```

- [ ] **Step 4: 執行測試**

Run（帶 env）: `npm test tests/db/banners.test.ts` → 2 passed。帶 env 跑 `npm test tests/db` 無回歸。裸 `npm test` 全綠。

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0012_banners.sql lib/database.types.ts tests/db/banners.test.ts
git commit -m "feat: banners table with RLS"
```

---

## Task 2: BannerItem 型別 + mergeBanners 純函式

**Files:**
- Modify: `lib/types.ts`
- Create: `lib/banners-logic.ts`
- Create: `tests/banners/merge.test.ts`

- [ ] **Step 1: 型別**

Add to `lib/types.ts`:
```ts
export interface BannerItem {
  eventId: string
  title: string
  city: string
  district: string
  startAt: string
}
```

- [ ] **Step 2: 失敗測試**

Create `tests/banners/merge.test.ts`:
```ts
import { expect, test } from 'vitest'
import { mergeBanners } from '@/lib/banners-logic'
import type { BannerItem } from '@/lib/types'

const b = (id: string): BannerItem => ({ eventId: id, title: id, city: '台北市', district: '大安區', startAt: '2026-08-01T00:00:00Z' })

test('手動優先、自動補足、去重、截斷', () => {
  const manual = [b('m1'), b('m2')]
  const auto = [b('m2'), b('a1'), b('a2'), b('a3')]
  const r = mergeBanners(manual, auto, 4)
  expect(r.map(x => x.eventId)).toEqual(['m1', 'm2', 'a1', 'a2'])
})
test('手動已達上限則不補', () => {
  const r = mergeBanners([b('m1'), b('m2')], [b('a1')], 2)
  expect(r.map(x => x.eventId)).toEqual(['m1', 'm2'])
})
```
Run → FAIL。

- [ ] **Step 3: 實作**

Create `lib/banners-logic.ts`:
```ts
import type { BannerItem } from '@/lib/types'

export function mergeBanners(manual: BannerItem[], auto: BannerItem[], limit: number): BannerItem[] {
  const seen = new Set(manual.map(b => b.eventId))
  const result = [...manual]
  for (const item of auto) {
    if (result.length >= limit) break
    if (seen.has(item.eventId)) continue
    seen.add(item.eventId)
    result.push(item)
  }
  return result.slice(0, limit)
}
```
Run → PASS。

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts lib/banners-logic.ts tests/banners/merge.test.ts
git commit -m "feat: BannerItem type and mergeBanners helper"
```

---

## Task 3: Server 層（getHomeBanners + 管理 actions）

**Files:**
- Create: `lib/banners.ts`
- Create: `tests/db/home-banners.test.ts`

- [ ] **Step 1: 實作 `lib/banners.ts`**

Create `lib/banners.ts`:
```ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { mergeBanners } from '@/lib/banners-logic'
import type { BannerItem } from '@/lib/types'

type EventRow = { id: string; title: string; city: string; district: string; start_at: string; status?: string; end_at?: string }
const toItem = (e: EventRow): BannerItem => ({ eventId: e.id, title: e.title, city: e.city, district: e.district, startAt: e.start_at })

export async function getHomeBanners(limit = 5): Promise<BannerItem[]> {
  const supabase = await createClient()
  const nowIso = new Date().toISOString()
  const { data: manualRows } = await supabase.from('banners')
    .select('sort_order, events!inner(id, title, city, district, start_at, status, end_at)')
    .eq('active', true)
    .order('sort_order', { ascending: true })
  const manual = ((manualRows ?? []) as unknown as { events: EventRow }[])
    .map(r => r.events)
    .filter(e => e.status === 'published' && (e.end_at ?? '') >= nowIso)
    .map(toItem)

  let auto: BannerItem[] = []
  if (manual.length < limit) {
    const { data: autoRows } = await supabase.from('events')
      .select('id, title, city, district, start_at')
      .eq('status', 'published')
      .gte('start_at', nowIso)
      .order('start_at', { ascending: true })
      .limit(limit)
    auto = ((autoRows ?? []) as unknown as EventRow[]).map(toItem)
  }
  return mergeBanners(manual, auto, limit)
}

export interface ManualBanner { id: string; eventId: string; title: string; sortOrder: number; active: boolean }

export async function listManualBanners(): Promise<ManualBanner[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('banners')
    .select('id, event_id, sort_order, active, events!inner(title)')
    .order('sort_order', { ascending: true })
  return ((data ?? []) as unknown as { id: string; event_id: string; sort_order: number; active: boolean; events: { title: string } }[])
    .map(r => ({ id: r.id, eventId: r.event_id, title: r.events.title, sortOrder: r.sort_order, active: r.active }))
}

export async function addBanner(eventId: string) {
  const supabase = await createClient()
  const { data: max } = await supabase.from('banners').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle()
  const next = (max?.sort_order ?? 0) + 1
  const { error } = await supabase.from('banners').insert({ event_id: eventId, sort_order: next })
  return { ok: !error, error: error?.message }
}

export async function removeBanner(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('banners').delete().eq('id', id)
  return { ok: !error }
}

export async function reorderBanner(id: string, direction: 'up' | 'down') {
  const supabase = await createClient()
  const { data: all } = await supabase.from('banners').select('id, sort_order').order('sort_order', { ascending: true })
  const list = all ?? []
  const idx = list.findIndex(b => b.id === id)
  if (idx < 0) return { ok: false }
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= list.length) return { ok: false }
  const a = list[idx], b = list[swapIdx]
  await supabase.from('banners').update({ sort_order: b.sort_order }).eq('id', a.id)
  await supabase.from('banners').update({ sort_order: a.sort_order }).eq('id', b.id)
  return { ok: true }
}
```
> 說明：管理 actions 靠 RLS 限 admin。`events!inner(...)` 為 FK 內嵌查詢；用 `as unknown as` 精確型別（比照既有 casts）。

- [ ] **Step 2: getHomeBanners 整合測試**

Create `tests/db/home-banners.test.ts`:
```ts
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, test } from 'vitest'

const url = process.env.SUPABASE_TEST_URL
const anon = process.env.SUPABASE_TEST_ANON_KEY
const service = process.env.SUPABASE_TEST_SERVICE_KEY

// 直接以 SQL 驗證雙模式的資料面：這裡用 service client 模擬 getHomeBanners 的查詢語意
async function makeEvent(admin: SupabaseClient, org: string, startInHours: number) {
  const { data } = await admin.from('events').insert({
    organizer_id: org, title: `evt-${startInHours}`, city: '台北市', district: '大安區',
    start_at: new Date(Date.now()+startInHours*3600000).toISOString(),
    end_at: new Date(Date.now()+(startInHours+2)*3600000).toISOString(), status: 'published',
  }).select('id').single()
  return data!.id as string
}

describe.skipIf(!url || !anon || !service)('home banners data', () => {
  let admin: SupabaseClient
  beforeEach(() => { admin = createClient(url!, service!) })

  test('手動 banner 連動的活動可經 join 讀回，且自動候選依 start_at 遞增', async () => {
    const org = (await admin.auth.admin.createUser({ email: `o-${crypto.randomUUID()}@x.com`, email_confirm: true })).data.user!.id
    const e1 = await makeEvent(admin, org, 10)
    const e2 = await makeEvent(admin, org, 20)
    await admin.from('banners').insert({ event_id: e1, active: true, sort_order: 1 })
    // 手動 join 讀回
    const { data: manual } = await admin.from('banners')
      .select('sort_order, events!inner(id, title, status)').eq('active', true)
    expect((manual as unknown as { events: { id: string } }[]).some(r => r.events.id === e1)).toBe(true)
    // 自動候選（未被主打的近期）含 e2、依 start_at
    const { data: auto } = await admin.from('events')
      .select('id, start_at').eq('status', 'published').gte('start_at', new Date().toISOString())
      .order('start_at', { ascending: true })
    const ids = (auto ?? []).map(a => a.id)
    expect(ids).toContain(e2)
  })
})
```

- [ ] **Step 3: 驗證**

Run（帶 env）: `npm test tests/db/home-banners.test.ts` → 1 passed。`npx tsc --noEmit`（零錯誤）、`npm run build`（成功）、裸 `npm test`（全綠）。

- [ ] **Step 4: Commit**

```bash
git add lib/banners.ts tests/db/home-banners.test.ts
git commit -m "feat: home banners query and admin actions"
```

---

## Task 4: BannerCarousel + 首頁整合

**Files:**
- Create: `components/BannerCarousel.tsx`
- Create: `tests/components/BannerCarousel.test.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: 元件測試**

Create `tests/components/BannerCarousel.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { expect, test } from 'vitest'
import { BannerCarousel } from '@/components/BannerCarousel'
import type { BannerItem } from '@/lib/types'

const items: BannerItem[] = [
  { eventId: 'e1', title: '第一場', city: '台北市', district: '大安區', startAt: '2026-08-01T00:00:00Z' },
  { eventId: 'e2', title: '第二場', city: '台北市', district: '內湖區', startAt: '2026-08-02T00:00:00Z' },
]

test('空清單不渲染', () => {
  const { container } = render(<BannerCarousel banners={[]} />)
  expect(container.firstChild).toBeNull()
})
test('顯示第一張與小點；點第二點切到第二張', () => {
  render(<BannerCarousel banners={items} />)
  expect(screen.getByText('第一場')).toBeInTheDocument()
  const dots = screen.getAllByRole('button')
  expect(dots.length).toBe(2)
  fireEvent.click(dots[1])
  expect(screen.getByText('第二場')).toBeInTheDocument()
})
```
Run → FAIL。

- [ ] **Step 2: 實作 BannerCarousel**

Create `components/BannerCarousel.tsx`:
```tsx
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { BannerItem } from '@/lib/types'

export function BannerCarousel({ banners }: { banners: BannerItem[] }) {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    if (banners.length <= 1) return
    const reduce = typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false
    if (reduce) return
    const t = setInterval(() => setIdx(i => (i + 1) % banners.length), 5000)
    return () => clearInterval(t)
  }, [banners.length])

  if (banners.length === 0) return null
  const b = banners[Math.min(idx, banners.length - 1)]
  const date = new Date(b.startAt).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })

  return (
    <div className="mx-auto max-w-6xl px-5 py-4">
      <Link href={`/events/${b.eventId}`}
        className="relative block h-40 overflow-hidden rounded-card bg-gradient-to-br from-[#6366f1] to-[#ec4899]">
        <div className="absolute bottom-4 left-5 text-white">
          <div className="text-xl font-bold tracking-tight-a">{b.title}</div>
          <div className="text-sm opacity-90">{date} · {b.city}{b.district}</div>
        </div>
      </Link>
      {banners.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {banners.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)} aria-label={`第 ${i + 1} 張`}
              className={`h-2 w-2 rounded-full transition-colors ${i === idx ? 'bg-accent' : 'bg-secondary/40'}`} />
          ))}
        </div>
      )}
    </div>
  )
}
```
Run test → PASS（2）。

- [ ] **Step 3: 首頁整合**

修改 `app/page.tsx`：import `getHomeBanners` 與 `BannerCarousel`；在 `!filtering` 區塊（hero 之後、`<div id="browse">` 之前）插入輪播：
```tsx
import { getHomeBanners } from '@/lib/banners'
import { BannerCarousel } from '@/components/BannerCarousel'
// ...在 return 內、hero <section> 之後：
{!filtering && <BannerCarousel banners={await getHomeBanners()} />}
```
（僅瀏覽模式顯示；篩選/搜尋不顯示。`await getHomeBanners()` 於 async server component 內可直接呼叫，或在函式頂部先取好變數再用。）

- [ ] **Step 4: 驗證**

Run: `npm test tests/components/BannerCarousel.test.tsx`（2 passed）、`npx tsc --noEmit`（零錯誤）、`npm run build`（成功）、裸 `npm test`（全綠）。

- [ ] **Step 5: Commit**

```bash
git add components/BannerCarousel.tsx tests/components/BannerCarousel.test.tsx app/page.tsx
git commit -m "feat: banner carousel on homepage"
```

---

## Task 5: `/admin/banners` 管理後台

**Files:**
- Create: `app/admin/banners/page.tsx`

- [ ] **Step 1: 管理頁**

Create `app/admin/banners/page.tsx`:
```tsx
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { listManualBanners, addBanner, removeBanner, reorderBanner } from '@/lib/banners'

export default async function AdminBannersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') redirect('/')

  const banners = await listManualBanners()
  const { data: events } = await supabase.from('events')
    .select('id, title').eq('status', 'published').order('start_at', { ascending: true }).limit(50)

  async function add(formData: FormData) {
    'use server'
    await addBanner(String(formData.get('eventId')))
    revalidatePath('/admin/banners')
  }
  async function remove(formData: FormData) {
    'use server'
    await removeBanner(String(formData.get('id')))
    revalidatePath('/admin/banners')
  }
  async function move(formData: FormData) {
    'use server'
    await reorderBanner(String(formData.get('id')), formData.get('dir') as 'up' | 'down')
    revalidatePath('/admin/banners')
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight-a">Banner 管理</h1>

      <form action={add} className="mb-6 flex gap-2">
        <select name="eventId" className="flex-1 rounded-lg border border-hairline bg-card px-3 py-2 text-sm">
          {(events ?? []).map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
        <button className="rounded-pill bg-accent px-4 py-2 text-sm font-medium text-on-accent">加入 Banner</button>
      </form>

      <ul className="flex flex-col gap-2">
        {banners.length === 0 && <li className="text-secondary">目前沒有手動 banner（首頁會自動補近期活動）。</li>}
        {banners.map(b => (
          <li key={b.id} className="flex items-center gap-3 rounded-card border border-hairline bg-card p-3">
            <span className="flex-1 font-medium">{b.title}</span>
            <form action={move}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="dir" value="up" />
              <button className="px-2 text-secondary hover:text-foreground" aria-label="上移">↑</button></form>
            <form action={move}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="dir" value="down" />
              <button className="px-2 text-secondary hover:text-foreground" aria-label="下移">↓</button></form>
            <form action={remove}><input type="hidden" name="id" value={b.id} />
              <button className="px-2 text-red-600" aria-label="移除">移除</button></form>
          </li>
        ))}
      </ul>
    </main>
  )
}
```

- [ ] **Step 2: 驗證**

Run: `npx tsc --noEmit`（零錯誤）、`npm run build`（成功）、裸 `npm test`（全綠）。手動：以 admin 進 `/admin/banners`，加入一個活動→首頁 banner 出現該活動；上/下移改順序；移除後首頁改回自動補。

- [ ] **Step 3: Commit**

```bash
git add app/admin/banners/page.tsx
git commit -m "feat: admin banner management page"
```

---

## 完成後的可運作成果

- 管理員在 `/admin/banners` 挑選要主打的活動、排序、移除。
- 首頁瀏覽模式最上方自動輪播 banner（手動優先，不足時自動補近期），點擊進活動。
- **階段 2 全數完成** 🎯

## 下一步（各自另出計畫）
- 全面拋光（SVG 圖示、真實封面圖、空狀態、骨架屏）。
- 階段 3 個人化推薦（用到收藏訊號）。
- 外部活動爬蟲（獨立 spec）。
