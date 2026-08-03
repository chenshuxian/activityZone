# 全面拋光 · 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在既有蘋果風設計系統上，補齊 SVG 圖示、載入骨架屏、手機導覽與 RWD、統一空狀態與微互動。

**Architecture:** 引入 lucide-react；新增可重用 UI 元件（Skeleton、EmptyState、MobileNav、EventCardSkeleton）；各路由加 loading.tsx；替換零散字元/emoji 圖示。功能不變。

**Tech Stack:** Next.js 15、Tailwind v4、lucide-react、Vitest + RTL。

**Scope:** 對應 spec `docs/superpowers/specs/2026-07-30-phase-polish-design.md`。不含封面圖上傳（另輪）。無資料模型變更、無 migration。

**測試/驗證**：拋光多為視覺。每個 task 以 `npx tsc --noEmit` 零錯誤 + `npm run build` 成功 + 裸 `npm test` 全綠為關卡；新元件加 RTL 測試。既有測試（FavoriteButton/NotificationBell）以 `aria-*`/`role` 斷言為主，改用 Lucide 後應仍通過——若有依賴字元文字者需同步更新。**視覺一致性與 RWD 由主控者於任務完成後以瀏覽器截圖驗證**（375 / 1280、亮/暗）。

---

## Task 1: lucide-react 圖示替換

**Files:**
- Modify: `package.json`（裝 lucide-react）
- Modify: `components/NotificationBell.tsx`, `components/FavoriteButton.tsx`, `components/FilterBar.tsx`, `components/ModerationGrid.tsx`, `app/admin/banners/page.tsx`, `components/RegistrationPanel.tsx`

- [ ] **Step 1: 安裝 lucide-react**

Run: `npm install lucide-react`
Expected: 安裝成功。

- [ ] **Step 2: NotificationBell 鈴鐺圖示**

在 `components/NotificationBell.tsx`（`NotificationBellView`）：import `{ Bell }` from `'lucide-react'`；把鈴鐺按鈕內的 `🔔` 換成 `<Bell size={20} aria-hidden />`。未讀徽章維持不變。

- [ ] **Step 3: FavoriteButton 愛心圖示**

在 `components/FavoriteButton.tsx`：import `{ Heart }` from `'lucide-react'`；把 `{fav ? '♥' : '♡'}` 換成 `<Heart size={variant === 'overlay' ? 18 : 20} className={fav ? 'fill-current' : ''} aria-hidden />`。`aria-pressed`/`aria-label` 維持不變（既有測試靠這些）。

- [ ] **Step 4: FilterBar 搜尋圖示**

在 `components/FilterBar.tsx`：import `{ Search }` from `'lucide-react'`；把搜尋 `<input>` 包一層 `relative` 容器，於左側絕對定位 `<Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-secondary" aria-hidden />`，input 加左內距 `pl-9`，placeholder 由「🔍 搜尋活動」改為「搜尋活動」。

- [ ] **Step 5: ModerationGrid 排序箭頭**

在 `components/ModerationGrid.tsx`：import `{ ChevronUp, ChevronDown }`；把 `arrow()` 回傳的 `' ↑'`/`' ↓'` 改為在表頭 label 旁條件渲染 `<ChevronUp size={14} className="inline" />` / `<ChevronDown size={14} className="inline" />`（僅當前排序欄顯示）。調整 `arrow` 為回傳 JSX 或在 th 內判斷。

- [ ] **Step 6: /admin/banners 圖示**

在 `app/admin/banners/page.tsx`：import `{ ChevronUp, ChevronDown, Trash2 }`；上移鈕內 `↑` → `<ChevronUp size={16} />`、下移 `↓` → `<ChevronDown size={16} />`、移除文字「移除」→ `<Trash2 size={16} />`（`aria-label` 保留）。

- [ ] **Step 7: RegistrationPanel 已報名勾**

在 `components/RegistrationPanel.tsx`：import `{ Check }`；把「✓ 已報名」的 `✓` 換成 `<Check size={16} className="inline" aria-hidden />`。

- [ ] **Step 8: 驗證**

Run: `npx tsc --noEmit`（零錯誤）、`npm run build`（成功）、裸 `npm test`（全綠——確認 FavoriteButton/NotificationBell 既有測試仍過；若因文字斷言失敗，把該斷言改為 `aria-label`/`role` 導向）。

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json components/NotificationBell.tsx components/FavoriteButton.tsx components/FilterBar.tsx components/ModerationGrid.tsx app/admin/banners/page.tsx components/RegistrationPanel.tsx
git commit -m "polish: replace char/emoji icons with lucide-react"
```

---

## Task 2: Skeleton 與 loading.tsx

**Files:**
- Create: `components/ui/Skeleton.tsx`, `components/EventCardSkeleton.tsx`
- Create: `tests/components/Skeleton.test.tsx`
- Create: `app/loading.tsx`, `app/events/[id]/loading.tsx`, `app/dashboard/loading.tsx`, `app/favorites/loading.tsx`

- [ ] **Step 1: Skeleton 測試**

Create `tests/components/Skeleton.test.tsx`:
```tsx
import { render } from '@testing-library/react'
import { expect, test } from 'vitest'
import { Skeleton } from '@/components/ui/Skeleton'

test('渲染脈動骨架塊', () => {
  const { container } = render(<Skeleton className="h-4 w-10" />)
  const el = container.firstChild as HTMLElement
  expect(el.className).toContain('animate-pulse')
  expect(el.className).toContain('h-4')
})
```
Run → FAIL。

- [ ] **Step 2: Skeleton 元件**

Create `components/ui/Skeleton.tsx`:
```tsx
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-chip ${className}`} />
}
```
Run → PASS。

- [ ] **Step 3: EventCardSkeleton**

Create `components/EventCardSkeleton.tsx`:
```tsx
import { Skeleton } from '@/components/ui/Skeleton'

export function EventCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-card bg-card shadow-card">
      <Skeleton className="h-32 w-full rounded-none" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 各路由 loading.tsx**

Create `app/loading.tsx`（首頁）：
```tsx
import { EventCardSkeleton } from '@/components/EventCardSkeleton'
import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <main>
      <div className="px-5 py-16 text-center">
        <Skeleton className="mx-auto h-12 w-2/3 max-w-xl" />
        <Skeleton className="mx-auto mt-4 h-5 w-1/2 max-w-md" />
      </div>
      <div className="mx-auto max-w-6xl px-5 py-4"><Skeleton className="h-40 w-full" /></div>
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-5 py-8 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <EventCardSkeleton key={i} />)}
      </div>
    </main>
  )
}
```

Create `app/events/[id]/loading.tsx`：
```tsx
import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <main>
      <Skeleton className="h-56 w-full rounded-none" />
      <div className="mx-auto max-w-2xl space-y-4 px-5 py-8">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    </main>
  )
}
```

Create `app/dashboard/loading.tsx` 與 `app/favorites/loading.tsx`（相似——標題骨架 + 幾個卡片/列骨架）：
```tsx
import { Skeleton } from '@/components/ui/Skeleton'
import { EventCardSkeleton } from '@/components/EventCardSkeleton'

export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <Skeleton className="mb-6 h-8 w-40" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <EventCardSkeleton key={i} />)}
      </div>
    </main>
  )
}
```
（dashboard 與 favorites 皆用此內容即可。）

- [ ] **Step 5: 驗證**

Run: `npm test tests/components/Skeleton.test.tsx`（PASS）、`npx tsc --noEmit`（零錯誤）、`npm run build`（成功——4 個 loading.tsx 編譯）、裸 `npm test`（全綠）。

- [ ] **Step 6: Commit**

```bash
git add components/ui/Skeleton.tsx components/EventCardSkeleton.tsx tests/components/Skeleton.test.tsx app/loading.tsx "app/events/[id]/loading.tsx" app/dashboard/loading.tsx app/favorites/loading.tsx
git commit -m "polish: skeleton loading states for key routes"
```

---

## Task 3: EmptyState 元件與套用

**Files:**
- Create: `components/ui/EmptyState.tsx`
- Create: `tests/components/EmptyState.test.tsx`
- Modify: `app/page.tsx`, `app/favorites/page.tsx`, `app/dashboard/page.tsx`, `app/events/[id]/registrations/page.tsx`, `app/admin/moderation/page.tsx`（空狀態）, `components/ModerationGrid.tsx`（空列）, `app/admin/banners/page.tsx`

- [ ] **Step 1: EmptyState 測試**

Create `tests/components/EmptyState.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { Calendar } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

test('顯示標題與說明', () => {
  render(<EmptyState icon={Calendar} title="沒有活動" description="快來發布" />)
  expect(screen.getByText('沒有活動')).toBeInTheDocument()
  expect(screen.getByText('快來發布')).toBeInTheDocument()
})
```
Run → FAIL。

- [ ] **Step 2: EmptyState 元件**

Create `components/ui/EmptyState.tsx`:
```tsx
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({
  icon: Icon, title, description, action,
}: { icon: LucideIcon; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-5 py-16 text-center">
      <Icon size={40} className="text-secondary" aria-hidden strokeWidth={1.5} />
      <p className="text-lg font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm text-secondary">{description}</p>}
      {action}
    </div>
  )
}
```
Run → PASS。

- [ ] **Step 3: 套用到各空狀態**

以 `EmptyState` 取代各頁的純文字空狀態（挑合適 Lucide 圖示）：
- `app/page.tsx` 無活動：`icon={CalendarX}` title「目前還沒有活動」description「成為第一個發布的人吧！」action `<ButtonLink href="/events/new">發布活動</ButtonLink>`；篩選無結果：`icon={SearchX}` title「沒有符合的活動」。
- `app/favorites/page.tsx`：`icon={Heart}` title「還沒有收藏」description「在活動卡片點愛心即可收藏」。
- `app/dashboard/page.tsx`：`icon={CalendarPlus}` title「你還沒有發布任何活動」action 發布按鈕。
- `app/events/[id]/registrations/page.tsx` 無報名：改用 EmptyState（`icon={Users}` title「目前沒有報名」）——若目前是 table 內 `colSpan`，改為表格外的 EmptyState 或保留但風格一致。
- `app/admin/moderation/page.tsx` / `ModerationGrid` 無待審：`icon={CheckCircle2}` title「目前沒有待審核的活動」。
- `app/admin/banners/page.tsx` 無 banner：`icon={Image}` title「目前沒有手動 banner」description「首頁會自動補近期活動」。

各處 import 對應 Lucide 圖示與 `EmptyState`。

- [ ] **Step 4: 驗證**

Run: `npm test tests/components/EmptyState.test.tsx`（PASS）、`npx tsc --noEmit`（零錯誤）、`npm run build`（成功）、裸 `npm test`（全綠）。

- [ ] **Step 5: Commit**

```bash
git add components/ui/EmptyState.tsx tests/components/EmptyState.test.tsx app/page.tsx app/favorites/page.tsx app/dashboard/page.tsx "app/events/[id]/registrations/page.tsx" app/admin/moderation/page.tsx components/ModerationGrid.tsx app/admin/banners/page.tsx
git commit -m "polish: unified empty states"
```

---

## Task 4: MobileNav 與微互動

**Files:**
- Create: `components/MobileNav.tsx`
- Create: `tests/components/MobileNav.test.tsx`
- Modify: `components/Header.tsx`
- Modify: `components/FavoriteButton.tsx`, `components/RegistrationPanel.tsx`（忙碌 spinner）

- [ ] **Step 1: MobileNav 測試**

Create `tests/components/MobileNav.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { expect, test } from 'vitest'
import { MobileNav } from '@/components/MobileNav'

test('點漢堡展開選單，含登入會員連結', () => {
  render(<MobileNav loggedIn={true} />)
  // 展開前選單項不顯示
  expect(screen.queryByText('我的活動')).toBeNull()
  fireEvent.click(screen.getByLabelText('選單'))
  expect(screen.getByText('探索')).toBeInTheDocument()
  expect(screen.getByText('我的活動')).toBeInTheDocument()
})
test('未登入不顯示會員連結', () => {
  render(<MobileNav loggedIn={false} />)
  fireEvent.click(screen.getByLabelText('選單'))
  expect(screen.queryByText('我的活動')).toBeNull()
})
```
Run → FAIL。

- [ ] **Step 2: MobileNav 元件**

Create `components/MobileNav.tsx`:
```tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'

export function MobileNav({ loggedIn }: { loggedIn: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="sm:hidden">
      <button aria-label="選單" onClick={() => setOpen(o => !o)} className="flex items-center text-secondary">
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-12 z-40 border-b border-hairline bg-glass backdrop-blur-xl">
          <nav className="flex flex-col gap-1 px-5 py-3 text-sm" onClick={() => setOpen(false)}>
            <Link href="/" className="py-1.5">探索</Link>
            <Link href="/events/new" className="py-1.5">發布活動</Link>
            {loggedIn && <Link href="/dashboard" className="py-1.5">我的活動</Link>}
            {loggedIn && <Link href="/favorites" className="py-1.5">我的收藏</Link>}
          </nav>
        </div>
      )}
    </div>
  )
}
```
Run test → PASS（2）。

- [ ] **Step 3: Header 整合 MobileNav**

在 `components/Header.tsx`：import `{ MobileNav }`；在 Logo 之後、桌機 nav（`hidden sm:flex`）之外，加 `<MobileNav loggedIn={Boolean(email)} />`（僅手機顯示，元件內已 `sm:hidden`）。桌機 nav 維持。

- [ ] **Step 4: 微互動 — 忙碌 spinner**

- `components/FavoriteButton.tsx`：忙碌（`busy`）時，Heart 換成 `<Loader2 size={...} className="animate-spin" />`（import `{ Loader2 }`）。
- `components/RegistrationPanel.tsx`：送出/取消按鈕忙碌時，於文字前加 `<Loader2 size={16} className="mr-1 inline animate-spin" />`（沿用既有 `busy` 狀態）。

- [ ] **Step 5: 驗證**

Run: `npm test tests/components/MobileNav.test.tsx`（2 passed）、`npx tsc --noEmit`（零錯誤）、`npm run build`（成功）、裸 `npm test`（全綠）。

- [ ] **Step 6: Commit**

```bash
git add components/MobileNav.tsx tests/components/MobileNav.test.tsx components/Header.tsx components/FavoriteButton.tsx components/RegistrationPanel.tsx
git commit -m "polish: mobile nav and busy-state spinners"
```

---

## 主控者視覺驗證（各 task 後 + 全部完成後）

- 以瀏覽器於 **375px（手機）** 與 **1280px（桌機）**、**亮/暗** 兩模式檢視：首頁、詳情、發布表單、dashboard、名單、moderation、banners。
- 檢查：圖示一致、骨架屏出現、手機導覽可展開、空狀態一致、按鈕忙碌 spinner、無破版/橫向溢出。
- 發現不一致就地修正（小改動可直接 commit）。

## 完成後的可運作成果

- 全站 Lucide 圖示、載入骨架屏、手機導覽 + RWD、統一空狀態與忙碌微互動。功能不變、觀感提升。

## 下一步
- 真實封面圖上傳（Supabase Storage，另輪）。
- 階段 3 個人化推薦。
- 部署上線。
