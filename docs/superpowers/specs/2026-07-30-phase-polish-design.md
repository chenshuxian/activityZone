# 全面拋光 · 設計文件（Spec）

- 日期：2026-07-30
- 狀態：設計確認中
- 隸屬：階段 2 完成後的視覺拋光。設計系統：`docs/DESIGN_SYSTEM.md`
- 前置：階段 1、2a–2f、2b、2e 皆已完成並合併。

## 1. 目標

在既有蘋果風設計系統之上，把全站視覺體驗「上到滿」：一致的 SVG 圖示、載入骨架屏、手機 RWD、統一空狀態與微互動。功能不變，只提升觀感與體驗。

## 2. 範圍（四區）

### A. SVG 圖示系統
- 引入 **lucide-react**。
- 替換現有字元/emoji 圖示為 Lucide：
  - `NotificationBell`：🔔 → `Bell`（未讀徽章保留）。
  - `FavoriteButton`：♥/♡ → `Heart`（已收藏 `fill` + `text-accent`，未收藏線框）。
  - `FilterBar`：搜尋框內加 `Search` icon（絕對定位於左），移除 placeholder 的 🔍。
  - `ModerationGrid` 排序指示：↑/↓ → `ChevronUp`/`ChevronDown`。
  - `/admin/banners` reorder：↑/↓ → `ChevronUp`/`ChevronDown`；移除 → `Trash2`。
  - `RegistrationPanel` 已報名：`✓` → `Check`。
- 統一 icon 尺寸（預設 16 或 18）與 stroke（1.75~2）；`aria-hidden` 於裝飾性 icon，互動 icon 保留 `aria-label`。

### B. 載入骨架屏
- `components/ui/Skeleton.tsx`：脈動灰塊（`animate-pulse bg-chip rounded`），可傳 className。
- `components/EventCardSkeleton.tsx`：模擬活動卡片形狀。
- 各路由 `loading.tsx`（Next.js Suspense fallback）：
  - `app/loading.tsx`：首頁（hero 佔位 + banner 佔位 + 一列卡片骨架）。
  - `app/events/[id]/loading.tsx`：詳情（大圖 + 標題 + 數行 + 面板骨架）。
  - `app/dashboard/loading.tsx`、`app/favorites/loading.tsx`：標題 + 卡片/列表骨架。
- 尊重 `prefers-reduced-motion`（animate-pulse 於 reduced 時由既有全域規則降速）。

### C. RWD 手機細修
- **手機導覽**：目前 nav 為 `hidden sm:flex`，手機完全看不到導覽。新增 `components/MobileNav.tsx`（client）：手機顯示漢堡 `Menu` icon，點擊展開下拉含 探索/發布活動/（登入時）我的活動/我的收藏。桌機維持既有 nav。
- 手機間距/字級複查：hero、詳情 dl、表單、後台表格。
- 後台表格（`/dashboard` 名單頁的 table、ModerationGrid）確認 `overflow-x-auto` 於手機可橫向捲動。
- Netflix 橫向列在手機的觸控捲動（已 `overflow-x-auto no-scrollbar`）確認順暢。
- 驗證斷點：375（小手機）、768（平板）、1280（桌機）。

### D. 空狀態 + 微互動
- `components/ui/EmptyState.tsx`：接 `icon`（Lucide 元件）、`title`、選用 `description`、選用 `action`（ReactNode，如 ButtonLink）。統一樣式（置中、次要色、留白）。
- 套用到：首頁無活動、`/favorites` 無收藏、`/dashboard` 無活動、報名名單無報名、`/admin/moderation` 無待審、`/admin/banners` 無 banner。
- 微互動：
  - `FavoriteButton`/`RegistrationPanel`/表單送出 的忙碌狀態顯示 `Loader2` 旋轉 icon（`animate-spin`）。
  - hover/focus 態一致（沿用既有 token 過場 150–300ms）。

## 3. 測試策略

拋光多為視覺，難以 TDD。測試以此為主：
- **build 綠 + `tsc` 零錯誤**（每項改動後）。
- **少數元件測試**（Vitest + RTL）：
  - `EmptyState` 渲染 title/description/action。
  - `Skeleton` 渲染（有 `animate-pulse` class）。
  - `MobileNav` 點漢堡展開/收合、登入時顯示會員連結。
- **既有測試不被破壞**（FavoriteButton/NotificationBell 等改用 Lucide 後，其測試若依賴文字 `♥`/`🔔` 需同步更新為 `aria-label`/`role` 斷言）。
- **視覺驗證**：由主控者（非 subagent）以瀏覽器於 375 / 1280 兩寬度、亮/暗兩模式截圖確認一致性與 RWD。

## 4. 執行方式（非 subagent 全包）

- 機械性替換與新元件（Lucide 圖示、Skeleton、loading.tsx、EmptyState、MobileNav）→ 可交 subagent 依 plan 實作 + 元件測試。
- **視覺一致性與 RWD 迭代 → 主控者親自以瀏覽器截圖驗證**（subagent 看不到畫面）。plan 會標明哪些步驟需視覺驗證。

## 5. 範圍界線（本輪不做）

- **真實封面圖上傳**（Supabase Storage）→ 屬功能，另開一輪。卡片/詳情維持漸層佔位。
- 新功能、資料模型變更 → 無。
- 動畫大改版（頁面轉場動畫框架）→ 不做，僅一致化既有微互動。

## 6. 未解 / 實作時決定

- Lucide icon 的預設尺寸/stroke 常數，plan 時定（傾向 size=18, strokeWidth=1.75）。
- MobileNav 展開是下拉面板或全屏 sheet，plan 時定（傾向輕量下拉）。
- Skeleton 動畫在 reduced-motion 下是否完全停止，plan 時定（傾向降為靜態灰塊）。
