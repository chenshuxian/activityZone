# 地方活動網 · 階段 1（核心可用）實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 打造一個能用 Google 登入、發布活動送審、管理員審核、並讓訪客依地區/類別/關鍵字瀏覽與查看活動詳情的可運作網站。

**Architecture:** Next.js (App Router) 全端；Supabase 提供 Postgres、Google OAuth、Row Level Security；資料存取集中在 `lib/events` 與 `lib/supabase` 模組，UI 依責任切成小元件。前台只顯示 `published` 且未過期的活動，未上架活動由 RLS 於資料庫層級擋下。

**Tech Stack:** Next.js 15 (App Router, TypeScript)、Tailwind CSS、Supabase (Postgres + Auth + RLS)、Vitest + React Testing Library（單元/元件）、Playwright（e2e）、Supabase CLI（本機 DB 與 migration 測試）。

**Scope note:** 本計畫僅涵蓋設計文件 §10 的階段 1。報名/候補、收藏、通知、Banner、個人化推薦、檢舉、爬蟲屬階段 2/3 或後續子專案，各自另出計畫。對應 spec：`docs/superpowers/specs/2026-07-28-local-events-platform-design.md`。

---

## File Structure

- `lib/supabase/client.ts` — 瀏覽器端 Supabase client。
- `lib/supabase/server.ts` — Server Component / Route Handler 端 client（帶 cookie session）。
- `lib/types.ts` — 共用型別（EventStatus、Region、EventSummary、EventDetail…）。
- `lib/events/queries.ts` — 讀取：`listPublishedEvents`、`getEventById`。
- `lib/events/mutations.ts` — 寫入：`createEvent`、`submitEvent`、`approveEvent`、`rejectEvent`。
- `lib/regions.ts` — 台灣縣市 > 鄉鎮區靜態資料與輔助。
- `app/page.tsx` — 首頁（近期列表 + 篩選 + 搜尋）。
- `app/events/[id]/page.tsx` — 活動詳情。
- `app/events/new/page.tsx` + `EventForm.tsx` — 發布活動表單。
- `app/admin/moderation/page.tsx` — 管理員審核佇列。
- `app/auth/callback/route.ts` — OAuth 回呼。
- `components/` — `EventCard`、`FilterBar`、`Header` 等小元件。
- `supabase/migrations/*.sql` — schema 與 RLS。
- `tests/` 與 `e2e/` — Vitest 與 Playwright 測試。

---

## Task 0: 專案骨架與工具鏈

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `.env.local.example`, `app/layout.tsx`, `app/page.tsx`

- [ ] **Step 1: 建立 Next.js 專案**

Run:
```bash
npx create-next-app@latest . --typescript --tailwind --app --eslint --no-src-dir --import-alias "@/*"
```
Expected: 產生 Next.js 專案結構，`app/page.tsx` 存在。

- [ ] **Step 2: 安裝相依套件**

Run:
```bash
npm install @supabase/supabase-js @supabase/ssr
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom @playwright/test
npx playwright install chromium
```
Expected: 安裝成功，無錯誤。

- [ ] **Step 3: 設定 Vitest**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
})
```

Create `tests/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest'
```

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest",
"e2e": "playwright test"
```

- [ ] **Step 4: 驗證測試工具可運行（sanity test）**

Create `tests/sanity.test.ts`:
```ts
import { expect, test } from 'vitest'
test('vitest runs', () => { expect(1 + 1).toBe(2) })
```
Run: `npm test`
Expected: PASS，1 passed。

- [ ] **Step 5: 建立環境變數範本**

Create `.env.local.example`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```
(實際 `.env.local` 由開發者填入，勿進版控；確認 `.gitignore` 已含 `.env*.local` 與 `.superpowers/`。)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Vitest and Playwright"
```

---

## Task 1: 資料庫 Schema 與種子分類

**Files:**
- Create: `supabase/migrations/0001_init.sql`
- Create: `supabase/seed.sql`

- [ ] **Step 1: 初始化 Supabase 本機環境**

Run:
```bash
npx supabase init
npx supabase start
```
Expected: 本機 Postgres 啟動，印出 local API URL 與 anon key。

- [ ] **Step 2: 寫 schema migration**

Create `supabase/migrations/0001_init.sql`:
```sql
-- profiles：對應 auth.users
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  home_city text,
  home_district text,
  interests uuid[] default '{}',
  role text not null default 'member' check (role in ('member','admin')),
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  icon text,
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  cover_image text,
  organizer_name text,
  contact_info text,
  is_free boolean not null default true,
  fee_note text,
  city text not null,
  district text not null,
  address text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  registration_deadline timestamptz,
  capacity int,
  registration_fields jsonb not null default '{}',
  status text not null default 'draft'
    check (status in ('draft','pending','published','rejected','ended')),
  reject_reason text,
  source text not null default 'user' check (source in ('user','crawler')),
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index events_status_start_idx on public.events (status, start_at);

create table public.event_categories (
  event_id uuid references public.events(id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade,
  primary key (event_id, category_id)
);
```

- [ ] **Step 3: 寫種子分類**

Create `supabase/seed.sql`:
```sql
insert into public.categories (name, slug, icon) values
  ('音樂','music','🎵'),
  ('親子','family','👨‍👩‍👧'),
  ('手作','craft','🧵'),
  ('體育','sports','🏃'),
  ('飲食','food','🍜'),
  ('廟會','temple','🎏')
on conflict (slug) do nothing;
```

- [ ] **Step 4: 套用 migration 與種子**

Run:
```bash
npx supabase db reset
```
Expected: migration 與 seed 成功套用，無錯誤。

- [ ] **Step 5: 驗證 schema（整合測試）**

Create `tests/db/schema.test.ts`:
```ts
import { createClient } from '@supabase/supabase-js'
import { beforeAll, expect, test } from 'vitest'

// 讀取本機 supabase start 印出的值，或放進 .env.test
const url = process.env.SUPABASE_TEST_URL!
const anon = process.env.SUPABASE_TEST_ANON_KEY!

let db: ReturnType<typeof createClient>
beforeAll(() => { db = createClient(url, anon) })

test('種子分類含 6 個項目', async () => {
  const { data, error } = await db.from('categories').select('slug')
  expect(error).toBeNull()
  expect(data?.map(c => c.slug).sort()).toEqual(
    ['craft','family','food','music','sports','temple']
  )
})
```
Run: `SUPABASE_TEST_URL=<local-url> SUPABASE_TEST_ANON_KEY=<local-anon> npm test tests/db/schema.test.ts`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add supabase tests/db
git commit -m "feat: initial db schema and seed categories"
```

---

## Task 2: RLS 權限政策

**Files:**
- Create: `supabase/migrations/0003_rls.sql`  *(0002 已被 Task 1 的 grants migration 佔用)*
- Create: `tests/db/rls.test.ts`

> **注意**：除了 RLS 政策，本 migration 還必須為 `profiles` / `events` / `event_categories` 補上對 `anon`、`authenticated`、`service_role` 的資料表權限（`grant select/insert/update ...`），因為 CLI migration 以 `postgres` 角色執行，預設 ACL 不含這些權限（同 Task 1 的發現）。否則即使 RLS 政策允許，仍會 permission denied。

- [ ] **Step 1: 寫 RLS 政策**

Create `supabase/migrations/0003_rls.sql`:
```sql
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.events enable row level security;
alter table public.event_categories enable row level security;

-- 判斷目前使用者是否 admin 的輔助函式
create or replace function public.is_admin() returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- profiles：本人可讀寫自己；admin 可讀全部
create policy profiles_self_read on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy profiles_self_upsert on public.profiles
  for insert with check (id = auth.uid());
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid());

-- categories：任何人可讀；僅 admin 可寫
create policy categories_public_read on public.categories
  for select using (true);
create policy categories_admin_write on public.categories
  for all using (public.is_admin()) with check (public.is_admin());

-- events：已上架任何人可讀；本人可讀自己所有狀態；admin 可讀全部
create policy events_read on public.events
  for select using (
    status = 'published'
    or organizer_id = auth.uid()
    or public.is_admin()
  );
-- 會員可建立自己的活動
create policy events_insert on public.events
  for insert with check (organizer_id = auth.uid());
-- 本人可改自己的；admin 可改全部
create policy events_update on public.events
  for update using (organizer_id = auth.uid() or public.is_admin());

-- event_categories：跟隨可見的 event
create policy event_categories_read on public.event_categories
  for select using (
    exists (select 1 from public.events e where e.id = event_id
            and (e.status = 'published' or e.organizer_id = auth.uid() or public.is_admin()))
  );
create policy event_categories_write on public.event_categories
  for all using (
    exists (select 1 from public.events e where e.id = event_id
            and (e.organizer_id = auth.uid() or public.is_admin()))
  ) with check (
    exists (select 1 from public.events e where e.id = event_id
            and (e.organizer_id = auth.uid() or public.is_admin()))
  );
```

- [ ] **Step 2: 套用 migration**

Run: `npx supabase db reset`
Expected: 兩個 migration 皆套用成功。

- [ ] **Step 3: 寫 RLS 測試（未上架活動不外流）**

Create `tests/db/rls.test.ts`:
```ts
import { createClient } from '@supabase/supabase-js'
import { beforeAll, expect, test } from 'vitest'

const url = process.env.SUPABASE_TEST_URL!
const anon = process.env.SUPABASE_TEST_ANON_KEY!
const service = process.env.SUPABASE_TEST_SERVICE_KEY! // 繞過 RLS，用於建置測試資料

test('匿名者讀不到 pending 活動', async () => {
  const admin = createClient(url, service)
  // 用 service key 建一個 pending 活動（organizer 用任一既有 profile 或先建）
  const { data: prof } = await admin.from('profiles').insert({
    id: crypto.randomUUID(), display_name: 'seed-user',
  }).select('id').single()
  await admin.from('events').insert({
    organizer_id: prof!.id, title: 'hidden', city: '台北市', district: '大安區',
    start_at: new Date(Date.now()+86400000).toISOString(),
    end_at: new Date(Date.now()+90000000).toISOString(),
    status: 'pending',
  })

  const anonClient = createClient(url, anon)
  const { data } = await anonClient.from('events').select('id').eq('title', 'hidden')
  expect(data).toEqual([]) // RLS 擋下
})
```
Run: `npm test tests/db/rls.test.ts`（帶上三個環境變數）
Expected: FAIL（若政策沒生效，會讀到資料）→ 政策正確時 PASS。

- [ ] **Step 4: 執行測試確認通過**

Run: `npm test tests/db/rls.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0002_rls.sql tests/db/rls.test.ts
git commit -m "feat: row level security policies for events and profiles"
```

---

## Task 3: Supabase Client 與型別

**Files:**
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/types.ts`

- [ ] **Step 1: 定義共用型別**

Create `lib/types.ts`:
```ts
export type EventStatus = 'draft' | 'pending' | 'published' | 'rejected' | 'ended'
export type EventSource = 'user' | 'crawler'

export interface Category { id: string; name: string; slug: string; icon: string | null }

export interface EventSummary {
  id: string
  title: string
  coverImage: string | null
  city: string
  district: string
  startAt: string
  isFree: boolean
  capacity: number | null
  categories: Category[]
}

export interface EventDetail extends EventSummary {
  description: string | null
  organizerName: string | null
  contactInfo: string | null
  feeNote: string | null
  address: string | null
  endAt: string
  registrationDeadline: string | null
  status: EventStatus
}

export interface EventFilters {
  city?: string
  district?: string
  categorySlugs?: string[]
  keyword?: string
}
```

- [ ] **Step 2: 建立瀏覽器 client**

Create `lib/supabase/client.ts`:
```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
```

- [ ] **Step 3: 建立 server client**

Create `lib/supabase/server.ts`:
```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => {
          try { cookieStore.set(name, value, options) } catch {}
        }),
      },
    },
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts lib/supabase
git commit -m "feat: supabase clients and shared types"
```

---

## Task 4: Google 登入與 Profile 建立

**Files:**
- Create: `app/auth/callback/route.ts`, `components/Header.tsx`
- Create: `supabase/migrations/0003_profile_trigger.sql`
- Create: `e2e/auth.spec.ts`

- [ ] **Step 1: 設定 Google OAuth（手動一次性）**

在 Supabase 專案 → Authentication → Providers → Google 啟用，填入 Google Cloud OAuth client id/secret，redirect 設為 `<site>/auth/callback`。本機以 `npx supabase start` 的設定檔啟用。此步為設定，非程式碼。

- [ ] **Step 2: 自動建立 profile 的 trigger**

Create `supabase/migrations/0004_profile_trigger.sql`:
```sql
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', new.email),
          new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```
Run: `npx supabase db reset`
Expected: 套用成功。

- [ ] **Step 3: OAuth 回呼 route**

Create `app/auth/callback/route.ts`:
```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }
  return NextResponse.redirect(origin)
}
```

- [ ] **Step 4: Header 含登入/登出**

Create `components/Header.tsx`:
```tsx
'use client'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export function Header() {
  const supabase = createClient()
  const [email, setEmail] = useState<string | null>(null)
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
  }, [])
  const login = () => supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${location.origin}/auth/callback` },
  })
  const logout = () => supabase.auth.signOut().then(() => location.reload())
  return (
    <header className="flex items-center gap-3 p-3 border-b">
      <a href="/" className="font-bold">🎪 地方活動網</a>
      <div className="ml-auto">
        {email
          ? <button onClick={logout}>登出（{email}）</button>
          : <button onClick={login}>Google 登入</button>}
      </div>
    </header>
  )
}
```

- [ ] **Step 5: e2e 冒煙測試（登入按鈕存在）**

Create `e2e/auth.spec.ts`:
```ts
import { expect, test } from '@playwright/test'
test('首頁顯示 Google 登入按鈕', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Google 登入')).toBeVisible()
})
```
Run: `npm run e2e e2e/auth.spec.ts`
Expected: 需先 `npm run dev` 或設定 playwright webServer；PASS。

- [ ] **Step 6: Commit**

```bash
git add app/auth components/Header.tsx supabase/migrations/0004_profile_trigger.sql e2e/auth.spec.ts
git commit -m "feat: google login and automatic profile creation"
```

---

## Task 5: 活動讀取查詢

**Files:**
- Create: `lib/events/queries.ts`, `tests/events/queries.test.ts`

- [ ] **Step 1: 寫失敗測試（近期優先 + 只回 published）**

Create `tests/events/queries.test.ts`:
```ts
import { expect, test, vi } from 'vitest'
import { mapEventRow } from '@/lib/events/queries'

test('mapEventRow 把 DB 欄位轉成 EventSummary', () => {
  const row = {
    id: 'e1', title: '晨跑', cover_image: null,
    city: '台北市', district: '大安區',
    start_at: '2026-07-29T00:00:00Z', is_free: true, capacity: 20,
    event_categories: [{ categories: { id: 'c1', name: '體育', slug: 'sports', icon: '🏃' } }],
  }
  const s = mapEventRow(row as any)
  expect(s.title).toBe('晨跑')
  expect(s.categories[0].slug).toBe('sports')
  expect(s.startAt).toBe('2026-07-29T00:00:00Z')
})
```
Run: `npm test tests/events/queries.test.ts`
Expected: FAIL（`mapEventRow` 未定義）。

- [ ] **Step 2: 實作 queries**

Create `lib/events/queries.ts`:
```ts
import { createClient } from '@/lib/supabase/server'
import type { EventSummary, EventDetail, EventFilters } from '@/lib/types'

export function mapEventRow(row: any): EventSummary {
  return {
    id: row.id,
    title: row.title,
    coverImage: row.cover_image ?? null,
    city: row.city,
    district: row.district,
    startAt: row.start_at,
    isFree: row.is_free,
    capacity: row.capacity ?? null,
    categories: (row.event_categories ?? []).map((ec: any) => ec.categories),
  }
}

const SELECT = `
  id, title, cover_image, city, district, start_at, is_free, capacity,
  event_categories ( categories ( id, name, slug, icon ) )
`

export async function listPublishedEvents(filters: EventFilters = {}): Promise<EventSummary[]> {
  const supabase = await createClient()
  let q = supabase.from('events').select(SELECT)
    .eq('status', 'published')
    .gte('end_at', new Date().toISOString())   // 未過期
    .order('start_at', { ascending: true })     // 近期優先
  if (filters.city) q = q.eq('city', filters.city)
  if (filters.district) q = q.eq('district', filters.district)
  if (filters.keyword) q = q.ilike('title', `%${filters.keyword}%`)
  const { data, error } = await q
  if (error) throw error
  let events = (data ?? []).map(mapEventRow)
  if (filters.categorySlugs?.length) {
    events = events.filter(e =>
      e.categories.some(c => filters.categorySlugs!.includes(c.slug)))
  }
  return events
}

export async function getEventById(id: string): Promise<EventDetail | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('events')
    .select(`${SELECT}, description, organizer_name, contact_info, fee_note,
             address, end_at, registration_deadline, status`)
    .eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    ...mapEventRow(data),
    description: data.description ?? null,
    organizerName: data.organizer_name ?? null,
    contactInfo: data.contact_info ?? null,
    feeNote: data.fee_note ?? null,
    address: data.address ?? null,
    endAt: data.end_at,
    registrationDeadline: data.registration_deadline ?? null,
    status: data.status,
  }
}
```

- [ ] **Step 3: 執行測試確認通過**

Run: `npm test tests/events/queries.test.ts`
Expected: PASS。

- [ ] **Step 4: Commit**

```bash
git add lib/events/queries.ts tests/events/queries.test.ts
git commit -m "feat: event read queries with near-term-first ordering and filters"
```

---

## Task 6: 首頁（列表 + 篩選 + 搜尋）

**Files:**
- Create: `lib/regions.ts`, `components/EventCard.tsx`, `components/FilterBar.tsx`, `app/page.tsx`
- Create: `tests/components/EventCard.test.tsx`

- [ ] **Step 1: 地區靜態資料**

Create `lib/regions.ts`:
```ts
// MVP 先放主要縣市與其鄉鎮區；可逐步補齊
export const REGIONS: Record<string, string[]> = {
  '台北市': ['中正區','大安區','信義區','內湖區','士林區','中山區'],
  '新北市': ['板橋區','新莊區','中和區','永和區','三重區'],
  '台中市': ['西區','北區','南屯區','西屯區'],
  // …其餘縣市於後續補齊
}
export const CITIES = Object.keys(REGIONS)
```

- [ ] **Step 2: 寫 EventCard 失敗測試**

Create `tests/components/EventCard.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { EventCard } from '@/components/EventCard'

const ev = {
  id: 'e1', title: '晨跑', coverImage: null, city: '台北市', district: '大安區',
  startAt: '2026-07-29T23:00:00Z', isFree: true, capacity: 20,
  categories: [{ id: 'c1', name: '體育', slug: 'sports', icon: '🏃' }],
}

test('顯示標題、地區與類別', () => {
  render(<EventCard event={ev} />)
  expect(screen.getByText('晨跑')).toBeInTheDocument()
  expect(screen.getByText(/大安區/)).toBeInTheDocument()
  expect(screen.getByText(/體育/)).toBeInTheDocument()
})
```
Run: `npm test tests/components/EventCard.test.tsx`
Expected: FAIL（`EventCard` 未定義）。

- [ ] **Step 3: 實作 EventCard**

Create `components/EventCard.tsx`:
```tsx
import type { EventSummary } from '@/lib/types'

export function EventCard({ event }: { event: EventSummary }) {
  const date = new Date(event.startAt).toLocaleDateString('zh-TW')
  return (
    <a href={`/events/${event.id}`} className="block border rounded-lg overflow-hidden">
      <div className="h-24 bg-gray-200" />
      <div className="p-2">
        <div className="font-semibold text-sm">{event.title}</div>
        <div className="text-xs text-gray-500">
          {date} · {event.city}{event.district}
        </div>
        <div className="text-xs text-gray-500">
          {event.categories.map(c => c.name).join('・')}
          {event.isFree ? '・免費' : ''}
        </div>
      </div>
    </a>
  )
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npm test tests/components/EventCard.test.tsx`
Expected: PASS。

- [ ] **Step 5: FilterBar（受控元件，透過 URL query 傳篩選）**

Create `components/FilterBar.tsx`:
```tsx
'use client'
import { CITIES, REGIONS } from '@/lib/regions'
import type { Category } from '@/lib/types'
import { useRouter, useSearchParams } from 'next/navigation'

export function FilterBar({ categories }: { categories: Category[] }) {
  const router = useRouter()
  const params = useSearchParams()
  const city = params.get('city') ?? ''
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString())
    value ? next.set(key, value) : next.delete(key)
    if (key === 'city') next.delete('district')
    router.push(`/?${next.toString()}`)
  }
  return (
    <div className="flex flex-wrap gap-2 p-3">
      <input defaultValue={params.get('keyword') ?? ''} placeholder="🔍 搜尋活動"
        onKeyDown={e => { if (e.key === 'Enter') setParam('keyword', (e.target as HTMLInputElement).value) }}
        className="border rounded px-2 py-1" />
      <select value={city} onChange={e => setParam('city', e.target.value)} className="border rounded px-2 py-1">
        <option value="">全部縣市</option>
        {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      {city && (
        <select value={params.get('district') ?? ''} onChange={e => setParam('district', e.target.value)} className="border rounded px-2 py-1">
          <option value="">全部鄉鎮區</option>
          {REGIONS[city].map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      )}
      {categories.map(cat => {
        const active = params.get('cat') === cat.slug
        return <button key={cat.slug} onClick={() => setParam('cat', active ? '' : cat.slug)}
          className={`border rounded px-2 py-1 ${active ? 'bg-black text-white' : ''}`}>
          {cat.icon} {cat.name}
        </button>
      })}
    </div>
  )
}
```

- [ ] **Step 6: 首頁 Server Component**

Create `app/page.tsx`:
```tsx
import { EventCard } from '@/components/EventCard'
import { FilterBar } from '@/components/FilterBar'
import { Header } from '@/components/Header'
import { listPublishedEvents } from '@/lib/events/queries'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage({
  searchParams,
}: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams
  const supabase = await createClient()
  const { data: categories } = await supabase.from('categories').select('id,name,slug,icon')
  const events = await listPublishedEvents({
    city: sp.city, district: sp.district,
    categorySlugs: sp.cat ? [sp.cat] : undefined,
    keyword: sp.keyword,
  })
  return (
    <main>
      <Header />
      <FilterBar categories={categories ?? []} />
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3">
        {events.map(e => <EventCard key={e.id} event={e} />)}
        {events.length === 0 && <p className="text-gray-500">目前沒有符合的活動</p>}
      </section>
    </main>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add lib/regions.ts components/EventCard.tsx components/FilterBar.tsx app/page.tsx tests/components
git commit -m "feat: homepage with event list, region/category filter and search"
```

---

## Task 7: 活動詳情頁

**Files:**
- Create: `app/events/[id]/page.tsx`

- [ ] **Step 1: 詳情頁**

Create `app/events/[id]/page.tsx`:
```tsx
import { Header } from '@/components/Header'
import { getEventById } from '@/lib/events/queries'
import { notFound } from 'next/navigation'

export default async function EventDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ev = await getEventById(id)
  if (!ev || ev.status !== 'published') notFound()
  const maps = ev.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.address)}`
    : null
  return (
    <main>
      <Header />
      <article className="max-w-2xl mx-auto p-4">
        <h1 className="text-2xl font-bold">{ev.title}</h1>
        <p className="text-gray-600">
          📅 {new Date(ev.startAt).toLocaleString('zh-TW')} — {new Date(ev.endAt).toLocaleString('zh-TW')}
        </p>
        <p className="text-gray-600">
          📍 {ev.city}{ev.district} {ev.address}
          {maps && <a href={maps} target="_blank" className="text-blue-600 ml-2">在 Google Maps 開啟</a>}
        </p>
        <p className="text-gray-600">🏷️ {ev.categories.map(c => c.name).join('・')} · {ev.isFree ? '免費' : ev.feeNote}</p>
        <p className="text-gray-600">主辦：{ev.organizerName} · {ev.contactInfo}</p>
        <div className="mt-4 whitespace-pre-wrap">{ev.description}</div>
      </article>
    </main>
  )
}
```

- [ ] **Step 2: e2e 冒煙（詳情頁 404 對未上架）**

Create `e2e/event-detail.spec.ts`:
```ts
import { expect, test } from '@playwright/test'
test('不存在的活動回 404', async ({ page }) => {
  const res = await page.goto('/events/00000000-0000-0000-0000-000000000000')
  expect(res?.status()).toBe(404)
})
```
Run: `npm run e2e e2e/event-detail.spec.ts`
Expected: PASS。

- [ ] **Step 3: Commit**

```bash
git add app/events/[id]/page.tsx e2e/event-detail.spec.ts
git commit -m "feat: event detail page with maps link"
```

---

## Task 8: 發布活動表單（建立 → 待審核）

**Files:**
- Create: `lib/events/mutations.ts`, `tests/events/mutations.test.ts`
- Create: `app/events/new/page.tsx`, `components/EventForm.tsx`

- [ ] **Step 1: 寫 mutations 失敗測試（validateEventInput）**

Create `tests/events/mutations.test.ts`:
```ts
import { expect, test } from 'vitest'
import { validateEventInput } from '@/lib/events/mutations'

test('缺標題時回錯誤', () => {
  const errors = validateEventInput({ title: '', city: '台北市', district: '大安區',
    startAt: '2026-08-01T10:00', endAt: '2026-08-01T12:00' } as any)
  expect(errors).toContain('請填寫活動標題')
})
test('結束早於開始時回錯誤', () => {
  const errors = validateEventInput({ title: 'x', city: '台北市', district: '大安區',
    startAt: '2026-08-01T12:00', endAt: '2026-08-01T10:00' } as any)
  expect(errors).toContain('結束時間不得早於開始時間')
})
test('合法輸入回空陣列', () => {
  const errors = validateEventInput({ title: 'x', city: '台北市', district: '大安區',
    startAt: '2026-08-01T10:00', endAt: '2026-08-01T12:00' } as any)
  expect(errors).toEqual([])
})
```
Run: `npm test tests/events/mutations.test.ts`
Expected: FAIL（未定義）。

- [ ] **Step 2: 實作 mutations**

Create `lib/events/mutations.ts`:
```ts
import { createClient } from '@/lib/supabase/server'

export interface EventInput {
  title: string
  description?: string
  city: string
  district: string
  address?: string
  startAt: string
  endAt: string
  isFree: boolean
  feeNote?: string
  organizerName?: string
  contactInfo?: string
  capacity?: number | null
  categoryIds: string[]
}

export function validateEventInput(input: EventInput): string[] {
  const errors: string[] = []
  if (!input.title?.trim()) errors.push('請填寫活動標題')
  if (!input.city || !input.district) errors.push('請選擇活動地區')
  if (new Date(input.endAt) < new Date(input.startAt)) errors.push('結束時間不得早於開始時間')
  return errors
}

// Server Action：建立活動並直接送審（status = pending）
export async function createEvent(input: EventInput) {
  const errors = validateEventInput(input)
  if (errors.length) return { ok: false as const, errors }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, errors: ['請先登入'] }

  const { data, error } = await supabase.from('events').insert({
    organizer_id: user.id,
    title: input.title, description: input.description ?? null,
    city: input.city, district: input.district, address: input.address ?? null,
    start_at: input.startAt, end_at: input.endAt,
    is_free: input.isFree, fee_note: input.feeNote ?? null,
    organizer_name: input.organizerName ?? null, contact_info: input.contactInfo ?? null,
    capacity: input.capacity ?? null,
    status: 'pending',
  }).select('id').single()
  if (error) return { ok: false as const, errors: [error.message] }

  if (input.categoryIds.length) {
    await supabase.from('event_categories').insert(
      input.categoryIds.map(cid => ({ event_id: data.id, category_id: cid })))
  }
  return { ok: true as const, id: data.id }
}
```

- [ ] **Step 3: 執行測試確認通過**

Run: `npm test tests/events/mutations.test.ts`
Expected: PASS（3 passed）。

- [ ] **Step 4: 表單元件 + 頁面（呼叫 Server Action）**

Create `app/events/new/page.tsx`:
```tsx
import { EventForm } from '@/components/EventForm'
import { Header } from '@/components/Header'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function NewEventPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const { data: categories } = await supabase.from('categories').select('id,name,slug,icon')
  return (
    <main>
      <Header />
      <EventForm categories={categories ?? []} />
    </main>
  )
}
```

Create `components/EventForm.tsx`:
```tsx
'use client'
import { createEvent } from '@/lib/events/mutations'
import type { Category } from '@/lib/types'
import { CITIES, REGIONS } from '@/lib/regions'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function EventForm({ categories }: { categories: Category[] }) {
  const router = useRouter()
  const [city, setCity] = useState('')
  const [errors, setErrors] = useState<string[]>([])

  async function action(formData: FormData) {
    const res = await createEvent({
      title: String(formData.get('title') ?? ''),
      description: String(formData.get('description') ?? ''),
      city: String(formData.get('city') ?? ''),
      district: String(formData.get('district') ?? ''),
      address: String(formData.get('address') ?? ''),
      startAt: String(formData.get('startAt') ?? ''),
      endAt: String(formData.get('endAt') ?? ''),
      isFree: formData.get('isFree') === 'on',
      organizerName: String(formData.get('organizerName') ?? ''),
      contactInfo: String(formData.get('contactInfo') ?? ''),
      capacity: formData.get('capacity') ? Number(formData.get('capacity')) : null,
      categoryIds: formData.getAll('categoryIds').map(String),
    })
    if (!res.ok) { setErrors(res.errors); return }
    router.push('/events/mine')
  }

  return (
    <form action={action} className="max-w-xl mx-auto p-4 flex flex-col gap-2">
      <h1 className="text-xl font-bold">發布活動</h1>
      {errors.map(e => <p key={e} className="text-red-600 text-sm">{e}</p>)}
      <input name="title" placeholder="活動標題" className="border rounded px-2 py-1" />
      <select name="city" value={city} onChange={e => setCity(e.target.value)} className="border rounded px-2 py-1">
        <option value="">選擇縣市</option>
        {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <select name="district" className="border rounded px-2 py-1">
        <option value="">選擇鄉鎮區</option>
        {(REGIONS[city] ?? []).map(d => <option key={d} value={d}>{d}</option>)}
      </select>
      <input name="address" placeholder="地址" className="border rounded px-2 py-1" />
      <label>開始 <input type="datetime-local" name="startAt" className="border rounded px-2 py-1" /></label>
      <label>結束 <input type="datetime-local" name="endAt" className="border rounded px-2 py-1" /></label>
      <input name="capacity" type="number" placeholder="名額（留空=不限）" className="border rounded px-2 py-1" />
      <label><input type="checkbox" name="isFree" defaultChecked /> 免費活動</label>
      <input name="organizerName" placeholder="主辦單位" className="border rounded px-2 py-1" />
      <input name="contactInfo" placeholder="聯絡方式" className="border rounded px-2 py-1" />
      <textarea name="description" placeholder="活動描述" className="border rounded px-2 py-1" />
      <fieldset className="flex flex-wrap gap-2">
        {categories.map(c => (
          <label key={c.id} className="border rounded px-2 py-1">
            <input type="checkbox" name="categoryIds" value={c.id} /> {c.icon} {c.name}
          </label>
        ))}
      </fieldset>
      <button className="bg-black text-white rounded px-3 py-2">送出審核</button>
    </form>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/events/mutations.ts tests/events/mutations.test.ts app/events/new components/EventForm.tsx
git commit -m "feat: event submission form creating pending events"
```

---

## Task 9: 管理員審核佇列

**Files:**
- Modify: `lib/events/mutations.ts`（新增 `approveEvent`、`rejectEvent`）
- Create: `app/admin/moderation/page.tsx`
- Create: `tests/events/moderation.test.ts`

- [ ] **Step 1: 寫失敗測試（狀態轉移邏輯）**

Create `tests/events/moderation.test.ts`:
```ts
import { expect, test } from 'vitest'
import { nextStatusOnApprove, nextStatusOnReject } from '@/lib/events/mutations'

test('核准 pending → published', () => {
  expect(nextStatusOnApprove('pending')).toBe('published')
})
test('核准非 pending 應拒絕', () => {
  expect(() => nextStatusOnApprove('draft')).toThrow()
})
test('退回 pending → rejected', () => {
  expect(nextStatusOnReject('pending')).toBe('rejected')
})
```
Run: `npm test tests/events/moderation.test.ts`
Expected: FAIL（未定義）。

- [ ] **Step 2: 在 mutations 加入狀態邏輯與動作**

Add to `lib/events/mutations.ts`:
```ts
import type { EventStatus } from '@/lib/types'

export function nextStatusOnApprove(current: EventStatus): EventStatus {
  if (current !== 'pending') throw new Error('只能核准待審核的活動')
  return 'published'
}
export function nextStatusOnReject(current: EventStatus): EventStatus {
  if (current !== 'pending') throw new Error('只能退回待審核的活動')
  return 'rejected'
}

export async function approveEvent(id: string) {
  const supabase = await createClient()
  const { data: cur } = await supabase.from('events').select('status').eq('id', id).single()
  const next = nextStatusOnApprove(cur!.status)
  const { error } = await supabase.from('events').update({ status: next }).eq('id', id)
  return { ok: !error, error: error?.message }
}
export async function rejectEvent(id: string, reason: string) {
  const supabase = await createClient()
  const { data: cur } = await supabase.from('events').select('status').eq('id', id).single()
  const next = nextStatusOnReject(cur!.status)
  const { error } = await supabase.from('events')
    .update({ status: next, reject_reason: reason }).eq('id', id)
  return { ok: !error, error: error?.message }
}
```

- [ ] **Step 3: 執行測試確認通過**

Run: `npm test tests/events/moderation.test.ts`
Expected: PASS（3 passed）。

- [ ] **Step 4: 審核頁（僅 admin 可見，非 admin redirect）**

Create `app/admin/moderation/page.tsx`:
```tsx
import { Header } from '@/components/Header'
import { approveEvent, rejectEvent } from '@/lib/events/mutations'
import { createClient } from '@/lib/supabase/server'
import { redirect, revalidatePath } from 'next/cache'

export default async function ModerationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') redirect('/')

  const { data: pending } = await supabase.from('events')
    .select('id, title, city, district, start_at, organizer_name')
    .eq('status', 'pending').order('created_at', { ascending: true })

  async function approve(formData: FormData) {
    'use server'
    await approveEvent(String(formData.get('id')))
    revalidatePath('/admin/moderation')
  }
  async function reject(formData: FormData) {
    'use server'
    await rejectEvent(String(formData.get('id')), String(formData.get('reason') ?? ''))
    revalidatePath('/admin/moderation')
  }

  return (
    <main>
      <Header />
      <h1 className="text-xl font-bold p-3">待審核活動（{pending?.length ?? 0}）</h1>
      <ul className="flex flex-col gap-2 p-3">
        {(pending ?? []).map(e => (
          <li key={e.id} className="border rounded p-3">
            <div className="font-semibold">{e.title}</div>
            <div className="text-sm text-gray-500">
              {e.city}{e.district} · {new Date(e.start_at).toLocaleString('zh-TW')} · {e.organizer_name}
            </div>
            <div className="flex gap-2 mt-2">
              <form action={approve}><input type="hidden" name="id" value={e.id} />
                <button className="bg-green-600 text-white rounded px-3 py-1">核准</button></form>
              <form action={reject} className="flex gap-1">
                <input type="hidden" name="id" value={e.id} />
                <input name="reason" placeholder="退回原因" className="border rounded px-2" />
                <button className="bg-red-600 text-white rounded px-3 py-1">退回</button></form>
            </div>
          </li>
        ))}
      </ul>
    </main>
  )
}
```
> 註：`redirect` 來自 `next/navigation`、`revalidatePath` 來自 `next/cache`。實作時請分別 import（此處為節省篇幅併寫）：
> `import { redirect } from 'next/navigation'` 與 `import { revalidatePath } from 'next/cache'`。

- [ ] **Step 5: e2e 冒煙（非 admin 被導回首頁）**

Create `e2e/moderation.spec.ts`:
```ts
import { expect, test } from '@playwright/test'
test('未登入訪問審核頁被導回首頁', async ({ page }) => {
  await page.goto('/admin/moderation')
  await expect(page).toHaveURL('/')
})
```
Run: `npm run e2e e2e/moderation.spec.ts`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add lib/events/mutations.ts app/admin/moderation tests/events/moderation.test.ts e2e/moderation.spec.ts
git commit -m "feat: admin moderation queue with approve/reject"
```

---

## 階段 1 完成後的可運作成果

- 訪客可瀏覽、依縣市/鄉鎮區/類別/關鍵字篩選、查看活動詳情。
- 使用者可 Google 登入，發布活動（自動進待審核）。
- 管理員可在審核頁核准/退回。
- RLS 確保未上架活動不外流。

## 下一步（各自另出計畫）
- **階段 2**：報名 + 候補、收藏、主辦方後台 + CSV 匯出、站內通知、Banner（雙模式）、排程工作。
- **階段 3**：個人化推薦列、加入行事曆、分享/OG、檢舉、你附近列。
- **後續子專案**：外部活動爬蟲（獨立 spec）。
