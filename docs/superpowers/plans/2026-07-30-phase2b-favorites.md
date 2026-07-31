# 階段 2b · 收藏 · 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 登入使用者可在卡片與詳情頁一鍵收藏/取消，並在 `/favorites` 檢視收藏的活動。

**Architecture:** `favorites` 表 + RLS；server actions 切換與查詢；`FavoriteButton`（client，樂觀更新，未登入時 toggle 回 ok:false → 觸發登入）；EventCard 疊加愛心；列表頁先取收藏集合傳入每張卡。

**Tech Stack:** Next.js 15、Supabase（RLS）、Vitest（本機 DB 整合 + 元件）、既有 `components/ui` 與色彩 token。

**Scope:** 對應 spec `docs/superpowers/specs/2026-07-30-phase2b-favorites-design.md`。推薦運用屬階段 3。既有 migration 0001–0010；新增 0011。

本機 Supabase：API `http://127.0.0.1:54321`。整合測試以 `SUPABASE_TEST_URL` / `SUPABASE_TEST_ANON_KEY` / `SUPABASE_TEST_SERVICE_KEY` 傳入本機 key。簽入使用者 client 加 `{ auth: { persistSession: false, autoRefreshToken: false } }`。

**與 spec 的一處精簡**：`FavoriteButton` 不接 `isLoggedIn` prop。點擊一律呼叫 `toggleFavorite`；未登入時該 action 回 `{ ok:false }`，按鈕據此觸發 Google 登入。如此 EventCard 整合只需傳 `isFavorited`，不必到處傳登入狀態。

---

## File Structure

- `supabase/migrations/0011_favorites.sql` — favorites 表 + RLS + grants。
- `lib/database.types.ts` — 重生（新表）。
- `lib/favorites.ts` — server：toggleFavorite / getMyFavoriteEventIds / getMyFavorites（新）。
- `components/FavoriteButton.tsx` — 愛心按鈕（client，新）。
- `components/EventCard.tsx` — 疊加愛心（修改）。
- `app/page.tsx` — 首頁列/grid 傳入收藏集合（修改）。
- `app/favorites/page.tsx` — 我的收藏頁（新）。
- `app/events/[id]/page.tsx` — 詳情頁愛心（修改）。
- `components/Header.tsx` — 加「我的收藏」連結（修改）。
- 測試置於 `tests/`。

---

## Task 1: favorites 表 + RLS

**Files:**
- Create: `supabase/migrations/0011_favorites.sql`
- Modify: `lib/database.types.ts`（重生）
- Create: `tests/db/favorites.test.ts`

- [ ] **Step 1: 寫 migration**

Create `supabase/migrations/0011_favorites.sql`:
```sql
create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, event_id)
);
create index favorites_user_created_idx on public.favorites (user_id, created_at desc);

alter table public.favorites enable row level security;
create policy favorites_read on public.favorites for select using (user_id = auth.uid());
create policy favorites_insert on public.favorites for insert with check (user_id = auth.uid());
create policy favorites_delete on public.favorites for delete using (user_id = auth.uid());
grant select, insert, delete on public.favorites to authenticated;
grant all on public.favorites to service_role;
```

- [ ] **Step 2: 套用 + 重生型別**

Run:
```bash
npx supabase db reset
npx supabase gen types typescript --local > lib/database.types.ts
```
**注意**：`supabase gen types` 有時會把 `Connecting to db` 狀態行漏進檔案第一行——若有，刪掉該行。確認 `favorites` 出現在 Tables，且 `npx tsc --noEmit` 對該檔無錯誤。

- [ ] **Step 3: 整合測試**

Create `tests/db/favorites.test.ts`:
```ts
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, test } from 'vitest'

const url = process.env.SUPABASE_TEST_URL
const anon = process.env.SUPABASE_TEST_ANON_KEY
const service = process.env.SUPABASE_TEST_SERVICE_KEY

async function signedIn(admin: SupabaseClient) {
  const email = `u-${crypto.randomUUID()}@x.com`
  await admin.auth.admin.createUser({ email, password: 'pw', email_confirm: true })
  const c = createClient(url!, anon!, { auth: { persistSession: false, autoRefreshToken: false } })
  await c.auth.signInWithPassword({ email, password: 'pw' })
  const uid = (await c.auth.getUser()).data.user!.id
  return { client: c, uid }
}
async function makeEvent(admin: SupabaseClient, organizer: string) {
  const { data } = await admin.from('events').insert({
    organizer_id: organizer, title: '收藏測試', city: '台北市', district: '大安區',
    start_at: new Date(Date.now()+86400000).toISOString(),
    end_at: new Date(Date.now()+90000000).toISOString(), status: 'published',
  }).select('id').single()
  return data!.id as string
}

describe.skipIf(!url || !anon || !service)('favorites', () => {
  let admin: SupabaseClient
  beforeEach(() => { admin = createClient(url!, service!) })

  test('本人可新增收藏並讀回', async () => {
    const { client, uid } = await signedIn(admin)
    const eventId = await makeEvent(admin, uid)
    const { error } = await client.from('favorites').insert({ user_id: uid, event_id: eventId })
    expect(error).toBeNull()
    const { data } = await client.from('favorites').select('event_id')
    expect(data!.map(f => f.event_id)).toContain(eventId)
  })

  test('唯一約束避免重複收藏', async () => {
    const { client, uid } = await signedIn(admin)
    const eventId = await makeEvent(admin, uid)
    await client.from('favorites').insert({ user_id: uid, event_id: eventId })
    const { error } = await client.from('favorites').insert({ user_id: uid, event_id: eventId })
    expect(error).not.toBeNull()
  })

  test('RLS：讀不到他人的收藏', async () => {
    const a = await signedIn(admin)
    const eventId = await makeEvent(admin, a.uid)
    await a.client.from('favorites').insert({ user_id: a.uid, event_id: eventId })
    const b = await signedIn(admin)
    const { data } = await b.client.from('favorites').select('id').eq('user_id', a.uid)
    expect(data).toEqual([])
  })
})
```

- [ ] **Step 4: 執行測試**

Run（帶三個環境變數）: `npm test tests/db/favorites.test.ts` → 3 passed。帶 env 跑 `npm test tests/db` 無回歸。裸 `npm test` 全綠。

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0011_favorites.sql lib/database.types.ts tests/db/favorites.test.ts
git commit -m "feat: favorites table with RLS"
```

---

## Task 2: Server 層

**Files:**
- Create: `lib/favorites.ts`

- [ ] **Step 1: 實作**

Create `lib/favorites.ts`:
```ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { mapEventRow } from '@/lib/events/queries'
import type { EventSummary } from '@/lib/types'

export async function toggleFavorite(eventId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const }
  const { data: existing } = await supabase.from('favorites')
    .select('id').eq('user_id', user.id).eq('event_id', eventId).maybeSingle()
  if (existing) {
    await supabase.from('favorites').delete().eq('id', existing.id)
    return { ok: true as const, favorited: false }
  }
  await supabase.from('favorites').insert({ user_id: user.id, event_id: eventId })
  return { ok: true as const, favorited: true }
}

export async function getMyFavoriteEventIds(): Promise<string[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase.from('favorites').select('event_id').eq('user_id', user.id)
  return (data ?? []).map(f => f.event_id)
}

const SELECT = `
  id, title, cover_image, city, district, start_at, is_free, capacity,
  event_categories ( categories ( id, name, slug, icon ) )
`

export async function getMyFavorites(): Promise<EventSummary[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data: favs } = await supabase.from('favorites')
    .select('event_id').eq('user_id', user.id).order('created_at', { ascending: false })
  const ids = (favs ?? []).map(f => f.event_id)
  if (ids.length === 0) return []
  const { data: events } = await supabase.from('events').select(SELECT).in('id', ids)
  const rows = events ?? []
  // 依收藏順序排序
  const order = new Map(ids.map((id, i) => [id, i]))
  rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
  // 併入 registeredCount
  const { data: counts } = ids.length
    ? await supabase.from('event_registered_counts').select('event_id, registered_count').in('event_id', ids)
    : { data: [] as { event_id: string; registered_count: number }[] }
  const countMap = new Map((counts ?? []).map(c => [c.event_id, c.registered_count ?? 0]))
  return rows.map(r => ({ ...mapEventRow(r), registeredCount: countMap.get(r.id) ?? 0 }))
}
```
> 若 tsc 對 `.select()` 結果型別有疑（如 `rows.sort` 的 `a.id`），比照 `lib/events/queries.ts` 既有作法最小處理，不用 `any`。

- [ ] **Step 2: 驗證**

Run: `npx tsc --noEmit`（零新錯誤）、`npm run build`（成功）、裸 `npm test`（全綠）。

- [ ] **Step 3: Commit**

```bash
git add lib/favorites.ts
git commit -m "feat: favorites server actions and queries"
```

---

## Task 3: FavoriteButton + EventCard 疊加

**Files:**
- Create: `components/FavoriteButton.tsx`
- Create: `tests/components/FavoriteButton.test.tsx`
- Modify: `components/EventCard.tsx`

- [ ] **Step 1: 元件測試**

Create `tests/components/FavoriteButton.test.tsx`:
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

vi.mock('@/lib/favorites', () => ({
  toggleFavorite: vi.fn().mockResolvedValue({ ok: true, favorited: true }),
}))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { signInWithOAuth: vi.fn() } }) }))

import { FavoriteButton } from '@/components/FavoriteButton'
import { toggleFavorite } from '@/lib/favorites'

test('未收藏顯示空心、已收藏顯示實心', () => {
  const { rerender } = render(<FavoriteButton eventId="e1" initialFavorited={false} />)
  expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('false')
  rerender(<FavoriteButton eventId="e1" initialFavorited={true} />)
  expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true')
})

test('點擊呼叫 toggleFavorite 並更新狀態', async () => {
  render(<FavoriteButton eventId="e1" initialFavorited={false} />)
  fireEvent.click(screen.getByRole('button'))
  await waitFor(() => expect(toggleFavorite).toHaveBeenCalledWith('e1'))
  await waitFor(() => expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true'))
})
```
Run → FAIL。

- [ ] **Step 2: 實作 FavoriteButton**

Create `components/FavoriteButton.tsx`:
```tsx
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toggleFavorite } from '@/lib/favorites'

export function FavoriteButton({
  eventId, initialFavorited, variant = 'inline',
}: { eventId: string; initialFavorited: boolean; variant?: 'inline' | 'overlay' }) {
  const [fav, setFav] = useState(initialFavorited)
  const [busy, setBusy] = useState(false)

  async function onClick(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    if (busy) return
    setBusy(true)
    const res = await toggleFavorite(eventId)
    setBusy(false)
    if (!res.ok) {
      // 未登入 → 觸發 Google 登入
      createClient().auth.signInWithOAuth({
        provider: 'google', options: { redirectTo: `${location.origin}/auth/callback` },
      })
      return
    }
    setFav(res.favorited)
  }

  const base = 'flex items-center justify-center transition-colors'
  const cls = variant === 'overlay'
    ? `${base} absolute right-2 top-2 h-8 w-8 rounded-full bg-card/80 backdrop-blur text-lg`
    : `${base} h-9 px-3 rounded-pill border border-hairline text-lg gap-1`

  return (
    <button onClick={onClick} aria-label="收藏" aria-pressed={fav}
      className={`${cls} ${fav ? 'text-accent' : 'text-secondary'} cursor-pointer`}>
      {fav ? '♥' : '♡'}
    </button>
  )
}
```
Run test → PASS（2）。

- [ ] **Step 3: EventCard 疊加愛心**

修改 `components/EventCard.tsx`：加選用 prop `isFavorited?: boolean`，在卡片圖容器上疊愛心。要點：
- import `FavoriteButton`。
- 圖片外層 `<div>` 改為 `relative`：`<div className="relative h-32 ...">`，內放 `<FavoriteButton variant="overlay" eventId={event.id} initialFavorited={event ? (props.isFavorited ?? false) : false} />`。
- 簽名改為 `export function EventCard({ event, isFavorited }: { event: EventSummary; isFavorited?: boolean })`；愛心 `initialFavorited={isFavorited ?? false}`。
- 因 EventCard 外層是 `<Link>`，FavoriteButton 內已 `preventDefault/stopPropagation`，點愛心不會跳頁。

- [ ] **Step 3b: 更新既有 EventCard 測試的 mock（重要）**

EventCard 現在會渲染 `FavoriteButton`，而 `FavoriteButton` import `@/lib/favorites`（server action，transitively import `next/headers`），在 vitest 直接載入會失敗。因此 `tests/components/EventCard.test.tsx` 需在檔案最上方加入 mock（在 import EventCard 之前）：
```tsx
import { vi } from 'vitest'
vi.mock('@/lib/favorites', () => ({ toggleFavorite: vi.fn().mockResolvedValue({ ok: true, favorited: true }) }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { signInWithOAuth: vi.fn() } }) }))
```
既有測試斷言（標題/地區/類別/剩餘名額）不變；EventCard 未傳 `isFavorited` 時愛心顯示空心，不影響既有斷言。

- [ ] **Step 4: 驗證**

Run: `npm test tests/components/FavoriteButton.test.tsx`（2 passed）、`npm test tests/components/EventCard.test.tsx`（既有測試仍過）、`npx tsc --noEmit`（零錯誤）、`npm run build`（成功）、裸 `npm test`（全綠）。

- [ ] **Step 5: Commit**

```bash
git add components/FavoriteButton.tsx tests/components/FavoriteButton.test.tsx components/EventCard.tsx tests/components/EventCard.test.tsx
git commit -m "feat: favorite button and event card overlay"
```

---

## Task 4: 頁面整合（首頁 / 收藏頁 / 詳情 / Header）

**Files:**
- Modify: `app/page.tsx`
- Create: `app/favorites/page.tsx`
- Modify: `app/events/[id]/page.tsx`
- Modify: `components/Header.tsx`

- [ ] **Step 1: 首頁傳入收藏集合**

修改 `app/page.tsx`：取得 `getMyFavoriteEventIds()` 建 `Set`，對每個 `<EventCard>` 傳 `isFavorited={favSet.has(e.id)}`。於檔案頂 import `getMyFavoriteEventIds`。在 `const events = ...` 後：
```tsx
  const favIds = new Set(await getMyFavoriteEventIds())
```
把所有 `<EventCard key={e.id} event={e} />` 改為 `<EventCard key={e.id} event={e} isFavorited={favIds.has(e.id)} />`（近期列、免費列、grid 三處）。

- [ ] **Step 2: 收藏頁**

Create `app/favorites/page.tsx`:
```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMyFavorites } from '@/lib/favorites'
import { EventCard } from '@/components/EventCard'

export default async function FavoritesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const events = await getMyFavorites()
  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight-a">我的收藏</h1>
      {events.length === 0 ? (
        <p className="text-secondary">你還沒有收藏任何活動。</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {events.map(e => <EventCard key={e.id} event={e} isFavorited={true} />)}
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 3: 詳情頁愛心**

修改 `app/events/[id]/page.tsx`：查本人是否收藏，於報名面板附近加 inline 愛心。於既有取 user 之後加：
```tsx
  const { data: fav } = user
    ? await supabase.from('favorites').select('id').eq('user_id', user.id).eq('event_id', id).maybeSingle()
    : { data: null }
```
import `FavoriteButton`，在報名面板 `<div className="my-6">` 內或其旁加：
```tsx
  <FavoriteButton eventId={ev.id} initialFavorited={Boolean(fav)} variant="inline" />
```
（放在報名面板上方或下方皆可，維持版面整齊。）

- [ ] **Step 4: Header 加「我的收藏」**

在 `components/Header.tsx` 的 nav（登入時），於「我的活動」旁加 `{email && <Link href="/favorites" className="transition-colors hover:text-foreground">我的收藏</Link>}`（沿用既有 class）。

- [ ] **Step 5: 驗證**

Run: `npx tsc --noEmit`（零錯誤）、`npm run build`（成功）、裸 `npm test`（全綠）。手動：登入後首頁卡片點愛心變實心、`/favorites` 出現該活動、詳情頁愛心同步、Header 有「我的收藏」。

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx app/favorites/page.tsx "app/events/[id]/page.tsx" components/Header.tsx
git commit -m "feat: favorites wiring on home, detail, favorites page and header"
```

---

## 完成後的可運作成果

- 登入使用者在卡片右上角與詳情頁一鍵收藏/取消（樂觀更新，未登入點擊觸發登入）。
- `/favorites` 檢視所有收藏；Header 有入口。
- 收藏隱私由 RLS 於資料庫層把關。

## 下一步（各自另出計畫）
- **2e** Banner 雙模式（做完階段 2 完整）。
- 全面拋光；階段 3（個人化推薦，會用到收藏訊號）。
