# 階段 2e · 首頁 Banner（雙模式）· 設計文件（Spec）

- 日期：2026-07-30
- 狀態：設計確認中
- 隸屬：階段 2 最後一個子系統。上層 spec：`2026-07-28-local-events-platform-design.md`
- 前置：階段 1、設計系統、2a、2c、2d、2f、2b 皆已完成並合併。

## 1. 目標

首頁最上方一個自動輪播的 Banner 區，主打特定活動。**雙模式**：管理員手動挑選要主打的活動；當手動不足時，自動以最近期的已上架活動補足。

## 2. 已定案的規則

- **Banner 內容連動活動**：管理員從已上架活動挑選；banner 標題/資訊取自活動，點擊進活動詳情頁。不做自訂圖片上傳。
- **雙模式**：手動 active banners（依 sort_order）優先；不足上限（預設 5）時，自動補最近期、尚未被主打的已上架活動。
- **輪播**：單張大 banner，每 5 秒自動切換，下方小點可點選。
- **不做時間窗排程**：以 `active` 開關控制；不使用 display 起訖日（YAGNI）。

## 3. 資料模型（migration 0012）

### `banners` 表
- `id uuid pk default gen_random_uuid()`
- `event_id uuid not null unique → events(id) on delete cascade`（唯一，避免同一活動重複主打）
- `sort_order int not null default 0`
- `active boolean not null default true`
- `created_at timestamptz not null default now()`
- 索引：`(active, sort_order)`
- RLS：
  - `select`：任何人可讀（`using (true)`）——首頁需要。
  - `insert`/`update`/`delete`：僅 `is_admin()`。
  - grants：select 給 anon/authenticated；all 給 service_role；insert/update/delete 給 authenticated（RLS 再以 is_admin 限制）。

## 4. Server 層

- `lib/banners.ts`：
  - `getHomeBanners(limit = 5)`：
    1. 取 active banners（join events，只保留 `status='published'` 且未過期），依 `sort_order, created_at`。
    2. 若不足 limit，補上最近期（`start_at >= now()`、`status='published'`）且不在上述清單的活動，依 `start_at` 遞增，補到 limit。
    3. 回 `BannerItem[]`：`{ eventId, title, city, district, startAt }`。
  - 管理端（server actions，`'use server'`，僅 admin——RLS 保障）：
    - `listManualBanners()`：回目前手動 banners（含活動標題、active、sort_order）。
    - `addBanner(eventId)`：新增一筆 banner（sort_order 取現有最大 +1）。
    - `removeBanner(id)`：刪除。
    - `reorderBanner(id, direction)`：與相鄰 banner 交換 sort_order（`'up'`/`'down'`）。
  - 純函式 `mergeBanners(manual, auto, limit)`（可單元測試）：把手動清單與自動候選合併去重、截到 limit。

## 5. 管理員後台 `/admin/banners`（admin-gated，非 admin 導向 `/`）

- 列出目前手動 banners：活動標題、狀態徽章、上/下移、移除。
- 「加入 Banner」：從已上架活動挑一個加入（下拉或列表 + 按鈕）。
- 沿用設計系統。

## 6. 首頁輪播

- `components/BannerCarousel.tsx`（client）：
  - props：`banners: BannerItem[]`。
  - 單張大 banner（漸層底 + 活動標題/日期/地區疊字），每 5 秒自動 `setInterval` 切下一張；`prefers-reduced-motion` 時不自動切。
  - 下方小點（dots）：目前張高亮、可點選跳張。
  - 點 banner → `/events/{eventId}`。
  - 空清單（無 banner）→ 不渲染。
- `app/page.tsx`：**瀏覽模式（未篩選）**時，在 hero 之下、篩選列/列表之上，放 `<BannerCarousel banners={await getHomeBanners()} />`。篩選/搜尋模式不顯示。

## 7. 測試

- **RLS 整合（真 DB）**：任何人（含匿名）可讀 banners；非 admin insert 被拒；admin 可 insert。
- **`getHomeBanners` 整合**：手動 active 優先且只含 published；不足時自動補近期；手動的活動不重複出現在自動補；過期/未上架不出現。
- **`mergeBanners` 純函式單元**：合併去重、截到 limit、手動優先。
- **`BannerCarousel` 元件**：渲染 N 張的第一張與 N 個小點；點第二個小點→顯示第二張；空清單不渲染。

## 8. 範圍界線（本階段不做）

- 自訂圖片上傳的 banner → 不做（連動活動）。
- 時間窗排程（display 起訖）→ 不做（active 開關）。
- Banner 點擊統計 → 不做。

## 9. 未解 / 實作時決定

- 自動補的「最近期」是否排除已被手動主打者，以 `not in (manual event ids)` 實作，plan 時定（傾向在 SQL 或 JS 端去重）。
- 自動輪播秒數（預設 5 秒）可日後調整。
- reorder 以交換相鄰 sort_order 實作；若同 sort_order 併發罕見，MVP 不特別處理。
