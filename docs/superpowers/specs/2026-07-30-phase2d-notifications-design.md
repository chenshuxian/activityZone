# 階段 2d · 站內通知 · 設計文件（Spec）

- 日期：2026-07-30
- 狀態：設計確認中
- 隸屬：階段 2 子系統。上層 spec：`docs/superpowers/specs/2026-07-28-local-events-platform-design.md`；報名系統：`2026-07-29-phase2a-registration-design.md`
- 前置：階段 1、設計系統、2a（報名+候補）、2c（後台）皆已完成並合併。

## 1. 目標

登入使用者在站內收到即時性通知（鈴鐺）：報名成功、加入候補、候補遞補成功、活動審核通過/退回。不做 email／推播。

## 2. 已定案的規則

- **通知由資料庫 trigger 自動產生**（非在應用層各處呼叫）——最穩，連 `cancel_registration` RPC 內部的遞補、以及任何直連 API 路徑都會觸發。
- **payload 存活動標題快照**，活動即使日後被刪，通知仍可正常顯示。
- **範圍界線**：時間驅動的「活動即將開始」通知屬 2f（排程）；本階段只做三類事件驅動通知（報名/候補、審核結果、遞補）。
- **MVP 不做即時推送**（realtime）：載入時取得 + 開面板時重取即可。

## 3. 資料模型（migration 0009）

### `notifications` 表
- `id uuid pk default gen_random_uuid()`
- `user_id uuid not null → profiles(id) on delete cascade`
- `type text not null check (type in ('registered','waitlisted','promoted','moderation_approved','moderation_rejected'))`
  - （`starting_soon` 於 2f 加入 check 清單）
- `payload jsonb not null default '{}'`（`{ eventId, eventTitle, reason? }`）
- `read_at timestamptz`（null = 未讀）
- `created_at timestamptz not null default now()`
- 索引：`(user_id, created_at desc)`；部分索引 `(user_id) where read_at is null`（未讀計數）
- RLS：`select`/`update` 限 `user_id = auth.uid()`；無 insert 政策（僅 trigger 以 definer 寫入）。grants 給 authenticated/service_role。

## 4. Triggers（產生通知）

一支輔助函式，帶入活動標題寫入通知：
```sql
create or replace function public.notify(p_user uuid, p_type text, p_event uuid, p_reason text default null)
returns void language plpgsql security definer as $$
declare v_title text;
begin
  select title into v_title from public.events where id = p_event;
  insert into public.notifications (user_id, type, payload)
  values (p_user, p_type,
    jsonb_build_object('eventId', p_event, 'eventTitle', coalesce(v_title,''))
      || case when p_reason is not null then jsonb_build_object('reason', p_reason) else '{}'::jsonb end);
end; $$;
```

Trigger 函式（皆 security definer）：
- **registrations AFTER INSERT**：`NEW.status='registered'` → `notify(NEW.user_id,'registered',NEW.event_id)`；`='waitlist'` → `'waitlisted'`。
- **registrations AFTER UPDATE**：`OLD.status='waitlist' AND NEW.status='registered'` → `notify(NEW.user_id,'promoted',NEW.event_id)`。
- **events AFTER UPDATE**：
  - `OLD.status='pending' AND NEW.status='published'` → `notify(NEW.organizer_id,'moderation_approved',NEW.id)`
  - `NEW.status='rejected' AND OLD.status<>'rejected'` → `notify(NEW.organizer_id,'moderation_rejected',NEW.id,NEW.reject_reason)`

> 這些 trigger 讓通知與既有 RPC/審核流程解耦：報名/遞補/審核照舊運作，通知自動附帶產生。

## 5. Server 層

- `lib/notifications.ts`：
  - `getNotifications(limit = 20)`：本人最近通知（依 created_at desc）。
  - `getUnreadCount()`：本人 `read_at is null` 計數。
  - `markRead(id)`（server action）：`update ... set read_at = now() where id = ? and user_id = auth.uid()`（RLS 亦保障）。
  - `markAllRead()`（server action）：本人所有未讀設為已讀。
- 純函式 `notificationMessage(type, payload)` → 中文訊息（可單元測試）：
  - `registered` → 「報名成功：{title}」
  - `waitlisted` → 「已加入候補：{title}」
  - `promoted` → 「候補遞補成功：{title}」
  - `moderation_approved` → 「活動已通過審核：{title}」
  - `moderation_rejected` → 「活動被退回：{title}（{reason}）」

## 6. UI — Header 鈴鐺

- `components/NotificationBell.tsx`（client）：
  - 掛載時取得 `getNotifications` 與未讀數；顯示鈴鐺 + 未讀徽章（>0 時）。
  - 點鈴鐺開/關下拉面板；開面板時重取。
  - 面板列出通知：訊息（`notificationMessage`）+ 相對時間；未讀項高亮（例如左側點或底色）。
  - 點單則 → `markRead(id)` 後導向 `/events/{eventId}`。
  - 面板頂部「全部標為已讀」→ `markAllRead()` 後重取。
  - 空狀態：「目前沒有通知」。
- Header 於登入時（`email` 有值）渲染 `<NotificationBell />`（在登出鈕旁）。沿用設計系統 token、亮/暗。

## 7. 測試

- **Trigger 整合測試（真 DB）**：
  - 報名 registered → 本人得到 `registered` 通知；報名 waitlist → `waitlisted`。
  - 取消 registered 觸發遞補 → 被遞補者得到 `promoted` 通知。
  - 活動 pending→published → 主辦方得到 `moderation_approved`。
  - 活動 →rejected → 主辦方得到 `moderation_rejected`，payload 含 reason。
- **RLS 整合**：使用者只讀得到自己的通知；他人讀不到。
- **純函式單元**：`notificationMessage` 各類型（含 reason 組裝）。
- **元件測試**：未讀徽章顯示數字；面板列出通知；點「全部已讀」呼叫對應行為。

## 8. 範圍界線（本階段不做）

- 「活動即將開始」時間驅動通知 → 2f（排程）。屆時 payload 相同、type 加 `starting_soon`。
- Email、Web Push → 非本階段（且屬產品排除項）。
- 即時 realtime 推送 → 之後可加（Supabase Realtime 訂閱 notifications）。

## 9. 未解 / 實作時決定

- 相對時間顯示（「3 分鐘前」）以輕量自寫函式或 `Intl.RelativeTimeFormat`，plan 時定。
- 鈴鐺面板為純 CSS 下拉或簡單狀態切換，plan 時定（傾向 client 狀態切換）。
