# 封面圖上傳 · 設計文件（Spec）

- 日期：2026-07-30
- 狀態：設計確認中
- 隸屬：階段 2 完成後的加值功能。上層 spec：`2026-07-28-local-events-platform-design.md`
- 前置：階段 1、2a–2f、2b、2e、全面拋光 皆已完成並合併。

## 1. 目標

主辦方發布/編輯活動時可上傳封面圖，取代目前的漸層佔位。封面圖選填；沒上傳則維持漸層。圖片存於 Supabase Storage 公開 bucket。

## 2. 已定案的規則

- **直接上傳**：不做裁切/壓縮。限格式 jpg/png/webp、大小 ≤ 5MB。
- **client 端直傳** Storage（帶使用者 session，RLS 控管）。
- **公開 bucket**：圖片以公開 URL 顯示給所有人。
- 主辦方只能上傳/刪除**自己資料夾**（`event-covers/{uid}/...`）的檔案。
- 顯示用一般 `<img>`（非 next/image），省去外部網域設定。

## 3. Storage（migration 0013）

- 建立公開 bucket：
```sql
insert into storage.buckets (id, name, public) values ('event-covers', 'event-covers', true)
on conflict (id) do nothing;
```
- storage.objects RLS（bucket 為 public，讀取走公開 URL，不需 select policy；仍設寫入政策）：
```sql
create policy "event-covers upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'event-covers' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "event-covers update own" on storage.objects for update to authenticated
  using (bucket_id = 'event-covers' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "event-covers delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'event-covers' and (storage.foldername(name))[1] = auth.uid()::text);
```
> 註：公開 bucket 的物件可經 `/storage/v1/object/public/event-covers/...` 讀取，無需 select policy。

## 4. 純邏輯

`lib/images.ts`（純函式，可單元測試）：
```ts
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export function validateImageFile(file: { type: string; size: number }): string | null
```
- 回錯誤訊息字串（型別不符 / 過大）或 `null`（合法）。

## 5. 上傳元件

`components/CoverImageUpload.tsx`（client）：
- props：`initialUrl?: string`、`onChange: (url: string | null) => void`。
- 內部：`<input type="file" accept="image/jpeg,image/png,image/webp">`；選檔 → `validateImageFile` → 若合法，用 `createClient()`（browser）取得使用者 id，`supabase.storage.from('event-covers').upload(\`${uid}/${crypto.randomUUID()}.${ext}\`, file, { upsert: false })`，取得 public URL（`supabase.storage.from('event-covers').getPublicUrl(path).data.publicUrl`），呼叫 `onChange(url)`，顯示預覽。
- 「移除」→ `onChange(null)`（清預覽；已上傳的檔案不強制刪除，MVP 容忍孤兒檔）。
- 上傳中顯示 spinner；錯誤顯示訊息。

## 6. EventForm 整合

- `EventInput`（`lib/events/mutations.ts`）加 `coverImage?: string | null`。
- `createEvent` / `updateEvent`（`lib/events/actions.ts`）insert/update 加 `cover_image: input.coverImage ?? null`。
- `EventForm`：以 `useState` 保存 `coverUrl`（初始 `initial?.coverImage`），渲染 `<CoverImageUpload initialUrl={...} onChange={setCoverUrl} />`；送出時把 `coverImage: coverUrl` 併入 input。
- 編輯頁 `getEventForEdit` 已回完整 event（含 `cover_image`）；編輯頁的 `initial` 加 `coverImage: ev.cover_image ?? ''`。

## 7. 顯示

- `EventCard`：`event.coverImage` 有值 → `<img src={event.coverImage} alt={event.title} className="h-full w-full object-cover" />` 於既有 `relative h-32` 容器（愛心疊加維持）；無值 → 維持漸層。
- 詳情頁 `app/events/[id]/page.tsx` 大圖（`h-56`）：同上邏輯（有封面用 img、無則漸層）。
- `BannerCarousel`：banner 的 `BannerItem` 加 `coverImage?: string | null`；`getHomeBanners` 併回 `cover_image`；有封面則 banner 用 img 背景，無則維持漸層。

## 8. 測試

- **Storage RLS 整合（真 DB）**：以登入使用者上傳小 buffer 到 `${uid}/x.png`（成功）；上傳到 `otherUid/x.png`（被拒）；上傳的物件可經 public URL 讀回。
- **`validateImageFile` 純函式單元**：合法 / 型別錯 / 過大。
- **EventCard 元件測試**：`coverImage` 有值渲染 `<img>`（`role="img"` 或 alt），無值不渲染 img（維持漸層 div）。

## 9. 範圍界線（本輪不做）

- 裁切/壓縮/縮圖 → 不做。
- 多圖 / 相簿 → 不做（單一封面）。
- 刪除活動時清 Storage 孤兒檔 → 不做（MVP 容忍）。

## 10. 未解 / 實作時決定

- Storage RLS 測試在本機 supabase 的 storage API 具體呼叫方式，plan 時定（`supabase.storage.from().upload(Blob/Buffer)`）。
- BannerCarousel/詳情用 `<img>` 或 CSS background-image，plan 時定（傾向 `<img> + object-cover`）。
- Next.js `<img>` 的 lint（`@next/next/no-img-element` 為 warning）以行內 eslint-disable 處理，plan 時定。
