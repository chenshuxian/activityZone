# 地方活動網 · 設計文件（Spec）

- 日期：2026-07-28
- 狀態：設計確認中
- 定位：side project / MVP（開發快、低成本、架構乾淨）

## 1. 產品概述

一個呈現「地方活動」的網站。使用者可依地區與類別瀏覽活動、報名參加、收藏；主辦方（一般會員）可發布活動送審；管理員審核與管理內容。核心價值是「在地活動的發現與報名」。

### 目標使用者
- **訪客**：瀏覽、搜尋、篩選已上架活動。
- **會員**：報名、收藏、設定個人化偏好、發布活動。
- **主辦方**：即發布過活動的會員，對自己的活動有管理權（編輯、看報名名單）。
- **管理員**：審核活動、管理分類/Banner、處理檢舉、管理會員。

## 2. 範圍（MVP）

### 核心需求（使用者原始 6 點）
1. 活動依「地區（縣市 > 鄉鎮區 兩層）」與「類別（多標籤）」分類。
2. 後台管理員審核與管理用戶自行上架的活動。
3. Google 帳號登入驗證與會員註冊。
4. 越近期的活動排在最上方。
5. 首頁 Banner 區呈現特定 / 近期活動（管理員可手動挑選）。
6. 登入後依所在地與興趣提供「站內個人化推薦」。

### 加入 MVP 的補充功能
- **報名（RSVP）**：站內報名，不涉金流。含名額上限、候補、報名截止時間。
- **關鍵字搜尋**：與分類/地區篩選並存。
- **收藏 / 我的最愛**：亦作為推薦訊號。
- **加入行事曆（.ics）**：一鍵加入 Google 日曆。
- **分享**：LINE / 複製連結 + 分享預覽（OG tags）。
- **地圖導航連結**：由地址「在 Google Maps 開啟」（不做內嵌地圖）。
- **主辦方後台**：管理自己的活動、檢視/匯出報名名單（CSV）。
- **站內通知（鈴鐺）**：報名成功、審核結果、活動即將開始、候補遞補。
- **檢舉機制**：使用者回報不當活動。

### 明確排除（之後再說，避免 MVP 膨脹）
- 金流 / 售票、Email 電子報、Web Push 推播、活動評分/回饋、自訂報名表單編輯器、地圖定位 / 附近排序（以行政區為地區粒度，暫不用經緯度）。
- **爬蟲 / 外部活動匯入**：獨立子專案，見 §13。MVP 僅預留 `events.source` 欄位。

## 3. 技術選型

**Next.js（React 全端）+ Supabase + Vercel 部署。**

- **Next.js**：前後端一體，SEO 友善（活動列表需搜尋曝光），使用 App Router。
- **Supabase**：託管 Postgres、Google OAuth 登入、圖片儲存（Storage）、Row Level Security（RLS）權限。免費方案足夠 MVP 起步。
- **Vercel**：前端/SSR 部署，免費方案起步。
- **不需自租主機**：兩個託管平台 + GitHub 連動即可上線。

選此方案原因：對「單人、要快、要省錢、架構要乾淨」最合適；RLS 能在資料庫層級優雅處理「主辦方只能看自己活動報名名單」「未上架活動不外流」等權限。

## 4. 資料模型

> 主鍵 `id`、`created_at`、`updated_at` 為各表通用，以下省略重複說明。

### profiles
- `id`（對應 Supabase auth 使用者）
- `display_name`, `avatar_url`
- `home_city`, `home_district`（所在地，兩層）
- `interests[]`（有興趣的 category id 陣列）
- `role`：`member` | `admin`

### events
- `organizer_id` → profiles
- `title`, `description`, `cover_image`
- `organizer_name`（主辦單位名稱）
- `contact_info`（聯絡方式）
- `is_free`（是否免費）, `fee_note`（費用說明，選填）
- `city`, `district`, `address`
- `start_at`, `end_at`
- `registration_deadline`（報名截止，選填）
- `capacity`（名額；null = 不限）
- `registration_fields`（JSON：報名要收哪些欄位，見 §6）
- `status`：`draft` | `pending` | `published` | `rejected` | `ended`
- `reject_reason`（退回原因，選填）
- `source`：`user` | `crawler`（來源；為未來爬蟲匯入預留，MVP 一律為 `user`）
- `source_url`（若來自爬蟲，原始活動連結，選填）

### categories
- `name`, `slug`, `icon`
- 由管理員預先建立。
- **初始種子分類**：音樂、親子、手作、體育、飲食、廟會。（管理員之後可增修）

### event_categories（多對多關聯）
- `event_id` → events
- `category_id` → categories
- 一個活動可掛多個標籤。

### registrations
- `event_id` → events
- `user_id` → profiles
- `status`：`registered` | `waitlist` | `cancelled`
- `party_size`（同行人數，選填）
- `form_answers`（JSON：額外欄位答案，如聯絡電話、備註）
- `created_at`（報名時間 → 候補排序依據）

### favorites
- `user_id` → profiles
- `event_id` → events

### notifications
- `user_id` → profiles
- `type`：報名成功 | 審核結果 | 活動即將開始 | 候補遞補
- `payload`（JSON）, `read_at`

### reports
- `event_id` → events
- `reporter_id` → profiles
- `reason`, `status`（open | resolved）

### banners
- `event_id` → events（或自訂內容）
- `image`, `title`, `sort_order`
- `active`, `display_start`, `display_end`
- **雙模式**：
  - 手動模式：管理員挑選要主打的活動（`active` 的 banner 優先）。
  - 自動模式：當沒有足夠的手動 banner 時，系統自動抓取最近期的已上架活動填補（依 `start_at` 近期優先，取前 N 筆）。前台輪播 = 手動 banner + 自動補足。

## 5. 角色與權限（以 Supabase RLS 實作）

| 能力 | 訪客 | 會員 | 管理員 |
|---|---|---|---|
| 瀏覽/搜尋/篩選已上架活動 | ✅ | ✅ | ✅ |
| Google 登入成為會員 | ✅ | — | — |
| 報名 / 收藏 | 需登入 | ✅ | ✅ |
| 設定所在地/興趣 → 個人化推薦 | — | ✅ | ✅ |
| 發布活動（送審） | — | ✅ | ✅ |
| 編輯/管理自己的活動 | — | ✅ 限本人 | ✅ 全部 |
| 看/匯出自己活動的報名名單 | — | ✅ 限本人 | ✅ 全部 |
| 檢舉活動 | — | ✅ | ✅ |
| 審核活動（核准/退回） | — | — | ✅ |
| 下架任意活動 / 處理檢舉 | — | — | ✅ |
| 管理分類 / Banner / 會員權限 | — | — | ✅ |

**安全關鍵（資料庫層級把關，非僅前端隱藏）：**
- 報名名單隱私：會員看不到他人活動的報名者。
- 未上架活動不外流：`draft` / `pending` / `rejected` 僅作者本人與管理員可見。
- 第一位管理員由開發者手動在資料庫指定。

## 6. 報名額外欄位（輕量做法）

不做表單編輯器。`events.registration_fields` 存一組開關設定，例如：
```json
{ "party_size": "required", "phone": "optional", "note": "off" }
```
主辦方發活動時勾選要收哪些；報名者的答案存進 `registrations.party_size` 與 `form_answers`。

## 7. 主要畫面與版面

### 首頁（瀏覽模式）— Netflix 式多列橫滑
由上而下：
1. **Header**：Logo、搜尋框、「發布活動」、使用者頭像。
2. **Banner 輪播**：管理員手動挑選的主打活動。
3. **多列橫滑**（每列左右滑，列尾「查看全部 →」，每列上限約 20 個）：
   - 🔥 近期活動（依 `start_at` 近期優先）
   - ✨ 為你推薦（登入後，依所在地 + 興趣）
   - 📍 你附近（依 `home_city` / `home_district`）
   - 可再擴充：本週精選、免費活動、各類別專屬列
4. **未登入訪客**：以「🔥 熱門活動 / 本週精選」取代「為你推薦」列，並提示「登入即可看到為你客製的活動」。

### 篩選 / 搜尋結果 — 方格 Grid
按下地區/類別篩選或關鍵字搜尋後，切換為方格 grid（一次看全一組明確結果），可續接分頁 / 無限載入。排序預設「近期優先」。

### 活動詳情頁
封面、標題、時間、地點（+ Google Maps 連結）、主辦單位/聯絡方式、費用、類別標籤、描述；報名區（名額/候補/截止狀態）；收藏、分享（LINE/複製連結）、加入行事曆（.ics）、檢舉。

### 發布/編輯活動頁
表單：基本資訊、地區、時間、名額、報名截止、報名欄位開關、封面上傳。送出即進 `pending`。

### 主辦方後台
自己的活動列表（含狀態）、編輯、報名/候補名單、匯出 CSV。

### 管理員後台
待審核佇列（核准/退回附原因）、所有活動管理（下架）、分類管理、Banner 管理、檢舉處理、會員/角色管理。

### RWD
手機優先設計，橫滑列在桌機補上左右箭頭按鈕。

## 8. 關鍵流程

### 流程 A · 發布 → 審核 → 上架
1. 會員填寫活動 → `draft`。
2. 送出審核 → `pending`。
3. 管理員：核准 → `published`；退回 → `rejected`（附原因，作者可修改再送）。
4. 系統依 `end_at` 自動將過期活動轉 `ended`（前台移除，主辦方後台仍可見）。
5. 管理員可隨時下架任何 `published` 活動。

### 流程 B · 報名 → 候補 → 遞補
1. 會員報名（填 `party_size` 等）。
2. 檢查：已過 `registration_deadline` → 擋下；未額滿 → `registered` + 通知；已額滿 → `waitlist`。
3. 有人取消 → 候補第一位（依 `created_at`）自動遞補 `registered` + 通知。
4. 活動開始前，系統發「即將開始」通知給報名者。
5. 主辦方後台可檢視/匯出名單。

## 9. 個人化推薦（MVP 規則式評分）

不使用機器學習。對候選的已上架未過期活動計分後排序：
- 地區：同鄉鎮區 +3、同縣市 +1。
- 類別：活動標籤 ∩ 使用者 `interests`，每命中 +2。
- 行為：曾收藏/報名同類別活動 +1。
- 近期：越接近 `start_at` 略微加分。

未來有足夠數據再進化為協同過濾等方法。

## 10. 分階段開發建議

MVP 功能不少，建議分階段讓核心先跑起來：

- **階段 1（核心可用）**：Google 登入、profiles、events、categories/event_categories、活動 CRUD + 審核流程、首頁近期列表 + 篩選/搜尋、活動詳情、管理員審核後台。
- **階段 2（互動）**：報名 + 候補、收藏、主辦方後台 + 匯出、站內通知、Banner 管理。
- **階段 3（加值）**：個人化推薦列、加入行事曆、分享/OG、檢舉、你附近列。

## 11. 排程工作（Cron / Supabase Scheduled Functions）

以排程函式（Supabase scheduled function 或 Vercel Cron）處理時間驅動的工作：
- 將 `end_at` 已過的活動轉為 `ended`。
- 活動開始前發送「即將開始」站內通知給報名者。
- （若採 banner 自動模式）刷新自動補足的近期活動。

## 12. 未解 / 待後續決定
- Banner 自動模式的補足數量 N，於實作時定。
- 排程頻率（如每 10 分鐘 / 每小時）於實作計畫決定。

## 13. 後續子專案 · 外部活動爬蟲（獨立設計）

**不屬於本 MVP，另開 spec → plan → 實作循環。** 此處僅記錄銜接方式：

- **獨立匯入服務**：與主站分離部署，主站不因爬蟲故障受影響。每個來源網站一支解析器。
- **寫入同一資料庫**：抓到的活動寫成 `events`，`source = crawler`、保留 `source_url`，掛在一個系統帳號（bot organizer）底下。
- **一樣進審核佇列**：`status = pending`，由管理員把關後才上架，確保品質。
- **法律 / ToS 注意**：僅抓公開的事實性資訊（名稱、時間、地點、原始連結），描述以摘要或導回原站為主，避免整段複製圖文；上線前確認來源網站的授權與 robots 政策。
- **技術重點（留待該子專案設計）**：去重、資料正規化（地區對應到縣市/鄉鎮區、分類對應到既有標籤）、來源網站改版的偵測與容錯、排程。
