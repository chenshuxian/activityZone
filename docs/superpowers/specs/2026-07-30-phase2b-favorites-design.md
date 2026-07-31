# 階段 2b · 收藏（我的最愛）· 設計文件（Spec）

- 日期：2026-07-30
- 狀態：設計確認中
- 隸屬：階段 2 子系統。上層 spec：`2026-07-28-local-events-platform-design.md`
- 前置：階段 1、設計系統、2a、2c、2d、2f 皆已完成並合併。

## 1. 目標

登入使用者可收藏／取消收藏活動；在活動卡片與詳情頁一鍵切換；有「我的收藏」頁檢視。收藏資料日後亦作個人化推薦訊號（推薦運用屬階段 3）。

## 2. 已定案的規則

- **收藏按鈕位置**：活動卡片右上角（疊在圖上、不跳頁）＋ 詳情頁。
- **未登入點收藏 → 觸發 Google 登入**（沿用報名面板做法）。
- **不公開**顯示「幾人收藏」；收藏僅本人可見。
- 推薦訊號運用 → 階段 3（本階段只建立資料與收藏 UI）。

## 3. 資料模型（migration 0011）

### `favorites` 表
- `id uuid pk default gen_random_uuid()`
- `user_id uuid not null → profiles(id) on delete cascade`
- `event_id uuid not null → events(id) on delete cascade`
- `created_at timestamptz not null default now()`
- 唯一約束 `unique (user_id, event_id)`
- 索引 `(user_id, created_at desc)`（收藏頁排序）
- RLS：`select`/`insert`/`delete` 皆限 `user_id = auth.uid()`；grants 給 authenticated/service_role。

## 4. Server 層

- `lib/favorites.ts`（server actions，`'use server'`）：
  - `toggleFavorite(eventId)`：查本人是否已收藏該活動；有→`delete`，無→`insert`；回傳 `{ ok: true, favorited: boolean }`（未登入回 `{ ok: false }`）。
  - `getMyFavoriteEventIds()`：回本人收藏的 `event_id` 陣列（供卡片標示；未登入回 `[]`）。
  - `getMyFavorites()`：回本人收藏的活動（`EventSummary[]`，依收藏時間新到舊；join events + 分類，只回仍存在的活動）。

## 5. UI

- **`components/FavoriteButton.tsx`**（client）：
  - props：`eventId`、`initialFavorited`、選用 `isLoggedIn`、選用 `variant`（`'overlay'` 卡片用 / `'inline'` 詳情用）。
  - 狀態：本地 `favorited`（樂觀更新）；點擊時 `preventDefault()`＋`stopPropagation()`（避免觸發外層卡片連結），呼叫 `toggleFavorite`；失敗則回滾。
  - 未登入點擊 → `supabase.auth.signInWithOAuth`（Google），不呼叫 toggle。
  - 圖示：實心/空心愛心（`♥`/`♡` 或 SVG），沿用設計系統色（收藏時 `text-accent`）。
- **`components/EventCard.tsx`**：新增選用 `isFavorited` prop；當提供時，於卡片圖右上角 `absolute` 疊 `<FavoriteButton variant="overlay" .../>`。卡片仍為 `Link`；愛心以 `preventDefault/stopPropagation` 不跳頁。
- **列表傳入收藏狀態**：`app/page.tsx`（首頁列/grid）、`app/favorites/page.tsx`、以及任何用 EventCard 的頁面，先取 `getMyFavoriteEventIds()` 建 `Set`，對每張卡傳 `isFavorited`。訪客為空集合（卡片仍顯示愛心，點擊觸發登入）。
- **詳情頁**：`app/events/[id]/page.tsx` 於報名面板附近加 `<FavoriteButton variant="inline" .../>`，`initialFavorited` 由詳情頁查詢本人是否收藏帶入。
- **`/favorites` 我的收藏頁**（server component，未登入導向 `/`）：以 grid 列出 `getMyFavorites()`；空狀態「你還沒有收藏任何活動」。
- **Header**：登入時 nav 加「我的收藏」→ `/favorites`。

## 6. 測試

- **RLS 整合（真 DB）**：使用者只讀得到自己的收藏；他人讀不到。唯一約束避免重複收藏。
- **toggle 整合**：新增後再 toggle → 移除（favorited 由 true→false）。
- **`getMyFavoriteEventIds` 整合**：回本人收藏的正確 id 集合。
- **`FavoriteButton` 元件測試**：`initialFavorited` 為 true 顯示實心、false 顯示空心；點擊（已登入）呼叫 toggle 並樂觀切換。

## 7. 範圍界線（本階段不做）

- 收藏作為推薦排序訊號 → 階段 3。
- 公開的收藏數統計 → 不做。
- Email／通知 收藏相關 → 不做。

## 8. 未解 / 實作時決定

- 詳情頁查「本人是否已收藏」以單獨查詢或併入既有查詢，plan 時定（傾向單獨輕量查詢）。
- 愛心圖示採 emoji（♥/♡）或內嵌 SVG，plan 時定（傾向內嵌 SVG，符合設計系統「不以 emoji 當結構圖示」；MVP 亦可先用字元愛心）。
