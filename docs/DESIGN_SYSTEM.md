# 活動網 · 設計系統

**方向：Apple 官網風 + 科技感** — 極簡、大量留白、精緻大標、中性色 + 單一藍色點綴、毛玻璃導覽、平滑細膩動態、亮/暗雙模式皆講究。

Tailwind v4（`@theme inline`，無 `tailwind.config.js`）。token 定義於 `app/globals.css`。

## 色彩 token（語意化，亮/暗自動切換）

| 用途 | Tailwind utility | 亮色 | 暗色 |
|---|---|---|---|
| 頁面底 | `bg-background` | `#ffffff` | `#000000` |
| 區塊/交錯底 | `bg-surface` | `#f5f5f7` | `#1d1d1f` |
| 卡片 | `bg-card` | `#ffffff` | `#1d1d1f` |
| 主要文字 | `text-foreground` | `#1d1d1f` | `#f5f5f7` |
| 次要文字 | `text-secondary` | `#6e6e73` | `#a1a1a6` |
| 品牌點綴/CTA | `bg-accent` `text-accent` | `#0071e3` | `#2997ff` |
| 點綴 hover | `bg-accent-hover` | `#0077ed` | `#0a84ff` |
| 分隔線/邊框 | `border-hairline` | `rgba(0,0,0,.08)` | `rgba(255,255,255,.12)` |
| 標籤底 | `bg-chip` | `#f5f5f7` | `#2c2c2e` |
| 毛玻璃導覽 | `bg-glass` | `rgba(255,255,255,.72)` | `rgba(22,22,24,.72)` |

**規則：元件內一律用語意 token，不要寫死 hex 或用 `gray-*`。**

## 字型

- **Noto Sans TC**（`next/font`，權重 400/500/600/700/900），涵蓋繁中。
- 大標用 900 + 負字距（`.tracking-hero` = -0.02em）；區塊標題用 700 + `.tracking-tight-a`（-0.01em）；內文 400；標籤/次要 500。

## 圓角・陰影・動態

- `rounded-card`（18px）卡片；`rounded-pill`（980px）按鈕/標籤/輸入框。
- `shadow-card` 靜態、`shadow-card-hover` hover。
- 過場 150–300ms、`ease-out`；卡片 hover 微浮起（`-translate-y-1`）。
- 尊重 `prefers-reduced-motion`（globals.css 已全域處理）。

## 基礎元件

- `components/ui/Button.tsx` — `Button` / `ButtonLink`，variant `primary`（藍底）/`ghost`（藍框）。pill 造型。
- `components/ui/Chip.tsx` — `Chip`，tone `default` / `accent`（藍字，用於「免費」）。
- `components/ui/Row.tsx` — Netflix 式橫向列（標題 + 副標 + 橫滑內容 + 可選「查看全部」）。

## 版面規則

- 內容容器 `max-w-6xl mx-auto px-5`。
- **首頁**：hero →（毛玻璃）FilterBar → 無篩選時 Netflix 多列（近期活動、免費活動…）；有篩選/搜尋時切換為 `grid`（2 欄手機 / 4 欄桌機）。
- 手機優先；橫向列用 `.no-scrollbar` 隱藏捲軸。
- 毛玻璃 Header：`sticky top-0` + `bg-glass` + `backdrop-blur-xl`。

## 待辦 / 之後拋光（非地基範圍）

- SVG 圖示系統（Lucide/Heroicons）取代目前少數 emoji；卡片縮圖改真實封面圖。
- 空狀態、載入骨架屏、列表左右箭頭按鈕（桌機橫滑輔助）、微互動與轉場一致化。
- 這些屬「全面拋光」，建議待階段 2 畫面（報名、主辦方後台）長出後一次做到位。
