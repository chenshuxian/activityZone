# 封面圖上傳 · 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 主辦方發布/編輯活動時可上傳封面圖（Supabase Storage），卡片/詳情/Banner 有封面就顯示、無則維持漸層。

**Architecture:** 公開 bucket `event-covers` + storage.objects RLS（只能寫自己資料夾）；client 直傳取得 public URL、存入 `events.cover_image`；顯示用 `<img object-cover>`，無封面 fallback 漸層。

**Tech Stack:** Next.js 15、Supabase Storage、lucide-react、Vitest（本機 DB/Storage 整合 + 純函式 + 元件）。

**Scope:** 對應 spec `docs/superpowers/specs/2026-07-30-cover-image-upload-design.md`。不做裁切/壓縮。既有 migration 0001–0012；新增 0013。

本機 Supabase：API `http://127.0.0.1:54321`。整合測試以 `SUPABASE_TEST_URL` / `SUPABASE_TEST_ANON_KEY` / `SUPABASE_TEST_SERVICE_KEY` 傳入本機 key。簽入 client 加 `{ auth: { persistSession: false, autoRefreshToken: false } }`。

---

## File Structure

- `supabase/migrations/0013_cover_storage.sql` — bucket + storage RLS。
- `lib/images.ts` — `validateImageFile` 純函式（新）。
- `components/CoverImageUpload.tsx` — 上傳元件（client，新）。
- `lib/events/mutations.ts` — `EventInput` 加 `coverImage`（修改）。
- `lib/events/actions.ts` — createEvent/updateEvent 寫 cover_image（修改）。
- `components/EventForm.tsx` — 整合上傳（修改）。
- `app/events/[id]/edit/page.tsx` — 預填 coverImage（修改）。
- `components/EventCard.tsx`、`app/events/[id]/page.tsx`、`components/BannerCarousel.tsx` — 顯示封面（修改）。
- `lib/types.ts`（`BannerItem` 加 coverImage）、`lib/banners.ts`（getHomeBanners 併 cover_image）（修改）。
- 測試置於 `tests/`。

---

## Task 1: Storage bucket + RLS

**Files:**
- Create: `supabase/migrations/0013_cover_storage.sql`
- Create: `tests/db/cover-storage.test.ts`

- [ ] **Step 1: 寫 migration**

Create `supabase/migrations/0013_cover_storage.sql`:
```sql
insert into storage.buckets (id, name, public)
  values ('event-covers', 'event-covers', true)
  on conflict (id) do nothing;

create policy "event-covers upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'event-covers' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "event-covers update own" on storage.objects for update to authenticated
  using (bucket_id = 'event-covers' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "event-covers delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'event-covers' and (storage.foldername(name))[1] = auth.uid()::text);
```

- [ ] **Step 2: 套用**

Run: `npx supabase db reset`
Expected: 0001–0013 皆套用成功（storage.objects 政策建立成功）。

- [ ] **Step 3: 整合測試**

Create `tests/db/cover-storage.test.ts`:
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
const png = () => new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]) // PNG magic bytes

describe.skipIf(!url || !anon || !service)('cover storage RLS', () => {
  let admin: SupabaseClient
  beforeEach(() => { admin = createClient(url!, service!) })

  test('可上傳到自己資料夾並經 public URL 讀回', async () => {
    const { client, uid } = await signedIn(admin)
    const path = `${uid}/${crypto.randomUUID()}.png`
    const { error } = await client.storage.from('event-covers').upload(path, png(), { contentType: 'image/png' })
    expect(error).toBeNull()
    const publicUrl = client.storage.from('event-covers').getPublicUrl(path).data.publicUrl
    const res = await fetch(publicUrl)
    expect(res.status).toBe(200)
  })

  test('不能上傳到他人資料夾', async () => {
    const { client } = await signedIn(admin)
    const other = crypto.randomUUID()
    const { error } = await client.storage.from('event-covers').upload(`${other}/x.png`, png(), { contentType: 'image/png' })
    expect(error).not.toBeNull()
  })
})
```

- [ ] **Step 4: 執行測試**

Run（帶 env）: `npm test tests/db/cover-storage.test.ts` → 2 passed。帶 env 跑 `npm test tests/db` 無回歸。裸 `npm test` 全綠。

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0013_cover_storage.sql tests/db/cover-storage.test.ts
git commit -m "feat: event-covers storage bucket with RLS"
```

---

## Task 2: validateImageFile 純函式

**Files:**
- Create: `lib/images.ts`
- Create: `tests/images/validate.test.ts`

- [ ] **Step 1: 失敗測試**

Create `tests/images/validate.test.ts`:
```ts
import { expect, test } from 'vitest'
import { validateImageFile, MAX_IMAGE_BYTES } from '@/lib/images'

test('合法圖片回 null', () => {
  expect(validateImageFile({ type: 'image/png', size: 1000 })).toBeNull()
})
test('型別不符回錯誤', () => {
  expect(validateImageFile({ type: 'text/plain', size: 1000 })).toMatch(/JPG|PNG|WebP/)
})
test('過大回錯誤', () => {
  expect(validateImageFile({ type: 'image/png', size: MAX_IMAGE_BYTES + 1 })).toMatch(/5MB/)
})
```
Run → FAIL。

- [ ] **Step 2: 實作**

Create `lib/images.ts`:
```ts
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function validateImageFile(file: { type: string; size: number }): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return '只接受 JPG / PNG / WebP 圖片'
  if (file.size > MAX_IMAGE_BYTES) return '圖片不能超過 5MB'
  return null
}
```
Run → PASS。

- [ ] **Step 3: Commit**

```bash
git add lib/images.ts tests/images/validate.test.ts
git commit -m "feat: image file validation helper"
```

---

## Task 3: CoverImageUpload 元件

**Files:**
- Create: `components/CoverImageUpload.tsx`
- Create: `tests/components/CoverImageUpload.test.tsx`

- [ ] **Step 1: 元件測試（驗證錯誤路徑，mock supabase client）**

Create `tests/components/CoverImageUpload.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

const uploadMock = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    storage: { from: () => ({ upload: uploadMock, getPublicUrl: () => ({ data: { publicUrl: 'http://x/cover.png' } }) }) },
  }),
}))

import { CoverImageUpload } from '@/components/CoverImageUpload'

test('選到非圖片檔顯示錯誤、不上傳', () => {
  const onChange = vi.fn()
  render(<CoverImageUpload onChange={onChange} />)
  const input = screen.getByLabelText(/選擇封面圖/) as HTMLInputElement
  const bad = new File(['x'], 'a.txt', { type: 'text/plain' })
  fireEvent.change(input, { target: { files: [bad] } })
  expect(screen.getByText(/JPG|PNG|WebP/)).toBeInTheDocument()
  expect(uploadMock).not.toHaveBeenCalled()
  expect(onChange).not.toHaveBeenCalled()
})
```
Run → FAIL。

- [ ] **Step 2: 實作**

Create `components/CoverImageUpload.tsx`:
```tsx
'use client'
import { useState, type ChangeEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { validateImageFile } from '@/lib/images'
import { Loader2, X } from 'lucide-react'

export function CoverImageUpload({
  initialUrl, onChange,
}: { initialUrl?: string; onChange: (url: string | null) => void }) {
  const [url, setUrl] = useState(initialUrl ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const err = validateImageFile(file)
    if (err) { setError(err); return }
    setError(null); setBusy(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('請先登入'); setBusy(false); return }
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`
    const { error: upErr } = await supabase.storage.from('event-covers').upload(path, file, { upsert: false })
    if (upErr) { setError(upErr.message); setBusy(false); return }
    const publicUrl = supabase.storage.from('event-covers').getPublicUrl(path).data.publicUrl
    setUrl(publicUrl); onChange(publicUrl); setBusy(false)
  }
  function remove() { setUrl(''); onChange(null) }

  return (
    <div>
      {url ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="封面預覽" className="h-40 w-full rounded-lg object-cover" />
          <button type="button" onClick={remove} aria-label="移除封面"
            className="absolute right-2 top-2 rounded-full bg-card/80 p-1 backdrop-blur"><X size={16} /></button>
        </div>
      ) : (
        <label className="flex h-40 cursor-pointer items-center justify-center rounded-lg border border-dashed border-hairline text-sm text-secondary">
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : '選擇封面圖（JPG/PNG/WebP，≤5MB）'}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onFile} disabled={busy} />
        </label>
      )}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}
```
> 註：測試以 `getByLabelText(/選擇封面圖/)` 取檔案 input（label 文字含此字串、`sr-only` input 綁定於 label）。
Run test → PASS。

- [ ] **Step 3: 驗證**

Run: `npm test tests/components/CoverImageUpload.test.tsx`（PASS）、`npx tsc --noEmit`（零錯誤）、`npm run build`（成功）、裸 `npm test`（全綠）。

- [ ] **Step 4: Commit**

```bash
git add components/CoverImageUpload.tsx tests/components/CoverImageUpload.test.tsx
git commit -m "feat: cover image upload component"
```

---

## Task 4: EventForm / actions 整合

**Files:**
- Modify: `lib/events/mutations.ts`, `lib/events/actions.ts`, `components/EventForm.tsx`, `app/events/[id]/edit/page.tsx`

- [ ] **Step 1: EventInput 加 coverImage**

在 `lib/events/mutations.ts` 的 `EventInput` 介面加：
```ts
  coverImage?: string | null
```

- [ ] **Step 2: createEvent / updateEvent 寫 cover_image**

在 `lib/events/actions.ts`：`createEvent` 的 insert 物件與 `updateEvent` 的 update 物件皆加：
```ts
    cover_image: input.coverImage ?? null,
```

- [ ] **Step 3: EventForm 整合上傳**

在 `components/EventForm.tsx`：
- import `{ CoverImageUpload }`。
- 加狀態：`const [coverUrl, setCoverUrl] = useState<string | null>(initial?.coverImage ?? null)`（`EventFormInitial` 加選用 `coverImage?: string`）。
- 在表單適當位置（標題下方）渲染：
```tsx
      <div>
        <label className={labelClass}>封面圖（選填）</label>
        <CoverImageUpload initialUrl={initial?.coverImage} onChange={setCoverUrl} />
      </div>
```
- 送出時把 `coverImage: coverUrl` 併入傳給 `createEvent`/`submitAction` 的 `EventInput`。

- [ ] **Step 4: 編輯頁預填**

在 `app/events/[id]/edit/page.tsx` 的 `initial` 物件加：
```tsx
    coverImage: ev.cover_image ?? '',
```

- [ ] **Step 5: 驗證**

Run: `npx tsc --noEmit`（零錯誤）、`npm run build`（成功）、裸 `npm test`（全綠，含既有 EventForm/mutations 測試）。

- [ ] **Step 6: Commit**

```bash
git add lib/events/mutations.ts lib/events/actions.ts components/EventForm.tsx "app/events/[id]/edit/page.tsx"
git commit -m "feat: wire cover image through event form and actions"
```

---

## Task 5: 顯示封面（卡片 / 詳情 / Banner）

**Files:**
- Modify: `components/EventCard.tsx`, `app/events/[id]/page.tsx`, `components/BannerCarousel.tsx`, `lib/types.ts`, `lib/banners.ts`
- Create: `tests/components/EventCardCover.test.tsx`

- [ ] **Step 1: EventCard 顯示封面測試**

Create `tests/components/EventCardCover.test.tsx`:
```tsx
import { vi } from 'vitest'
vi.mock('@/lib/favorites', () => ({ toggleFavorite: vi.fn().mockResolvedValue({ ok: true, favorited: true }) }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { signInWithOAuth: vi.fn() } }) }))
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { EventCard } from '@/components/EventCard'
import type { EventSummary } from '@/lib/types'

const base: EventSummary = {
  id: 'e1', title: '晨跑', coverImage: null, city: '台北市', district: '大安區',
  startAt: '2026-08-01T00:00:00Z', isFree: true, capacity: null, registeredCount: 0, categories: [],
}

test('有封面顯示 img', () => {
  render(<EventCard event={{ ...base, coverImage: 'http://x/c.png' }} />)
  expect(screen.getByAltText('晨跑')).toBeInTheDocument()
})
test('無封面不顯示 img', () => {
  render(<EventCard event={base} />)
  expect(screen.queryByAltText('晨跑')).toBeNull()
})
```
Run → FAIL（目前 EventCard 不渲染 img）。

- [ ] **Step 2: EventCard 顯示封面**

修改 `components/EventCard.tsx` 的圖片容器：
```tsx
      <div className="relative h-32 bg-gradient-to-br from-[#a8c0ff] to-[#3f6cd8]">
        {event.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.coverImage} alt={event.title} className="absolute inset-0 h-full w-full object-cover" />
        )}
        <FavoriteButton variant="overlay" eventId={event.id} initialFavorited={isFavorited ?? false} />
      </div>
```
Run test → PASS。

- [ ] **Step 3: 詳情頁封面**

修改 `app/events/[id]/page.tsx` 的頂部大圖：
```tsx
      <div className="relative h-56 w-full bg-gradient-to-br from-[#a8c0ff] to-[#3f6cd8]">
        {ev.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ev.coverImage} alt={ev.title} className="absolute inset-0 h-full w-full object-cover" />
        )}
      </div>
```
（`ev` 為 `EventDetail`，已含 `coverImage`。）

- [ ] **Step 4: BannerItem 加 coverImage + getHomeBanners 併入**

- `lib/types.ts` 的 `BannerItem` 加 `coverImage?: string | null`。
- `lib/banners.ts`：
  - `EventRow` type 加 `cover_image?: string | null`；`toItem` 回傳加 `coverImage: e.cover_image ?? null`。
  - manual 的 `.select('sort_order, events!inner(id, title, city, district, start_at, status, end_at, cover_image)')` 加 `cover_image`。
  - auto 的 `.select('id, title, city, district, start_at, cover_image')` 加 `cover_image`。

- [ ] **Step 5: BannerCarousel 顯示封面**

修改 `components/BannerCarousel.tsx` 的 banner `<Link>`：於漸層容器內，若 `b.coverImage` 則疊 `<img absolute inset-0 object-cover>`（文字疊字維持在上層，可加深色漸層遮罩確保可讀）：
```tsx
      <Link href={`/events/${b.eventId}`}
        className="relative block h-40 overflow-hidden rounded-card bg-gradient-to-br from-[#6366f1] to-[#ec4899]">
        {b.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.coverImage} alt={b.title} className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="absolute bottom-4 left-5 text-white">
          <div className="text-xl font-bold tracking-tight-a">{b.title}</div>
          <div className="text-sm opacity-90">{date} · {b.city}{b.district}</div>
        </div>
      </Link>
```

- [ ] **Step 6: 驗證**

Run: `npm test tests/components/EventCardCover.test.tsx`（2 passed）、`npx tsc --noEmit`（零錯誤）、`npm run build`（成功）、裸 `npm test`（全綠）。

- [ ] **Step 7: Commit**

```bash
git add components/EventCard.tsx "app/events/[id]/page.tsx" components/BannerCarousel.tsx lib/types.ts lib/banners.ts tests/components/EventCardCover.test.tsx
git commit -m "feat: display cover image on card, detail, and banner"
```

---

## 主控者視覺驗證

- 登入後發布一個帶封面的活動 → 首頁卡片、詳情、（若設為 banner）輪播顯示真實封面圖；未設封面者維持漸層。

## 完成後的可運作成果

- 主辦方可上傳封面圖（≤5MB、jpg/png/webp），存於 Storage、僅本人資料夾可寫。
- 卡片/詳情/Banner 有封面顯示封面、無則漸層。

## 下一步
- 階段 3 個人化推薦。
- 部署上線（雲端 Supabase 的 bucket 需同樣建立）。
