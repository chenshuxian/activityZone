# 階段 2f · 排程工作 · 設計文件（Spec）

- 日期：2026-07-30
- 狀態：設計確認中
- 隸屬：階段 2 子系統。上層 spec：`2026-07-28-local-events-platform-design.md`；通知：`2026-07-30-phase2d-notifications-design.md`
- 前置：階段 1、設計系統、2a、2c、2d 皆已完成並合併。

## 1. 目標

兩個時間驅動的背景工作：
1. 過期活動（已上架且結束時間已過）自動轉為 `ended`。
2. 活動開始前 24 小時，通知每位已報名（registered）者一次「活動即將開始」。

由 Postgres pg_cron 定期執行；工作邏輯寫成可獨立測試的 SQL 函式。

## 2. 已定案的規則

- **機制**：pg_cron + SQL 函式（本機/雲端 Supabase 皆支援；函式可直接呼叫測試）。
- **即將開始**：開始前 24 小時內；每位報名者每場只發一次（去重）。
- **系統操作旁路**：expire 需變更 events.status，會撞到 0008 的狀態守門 trigger。以 `app.system_op` session 旗標讓守門在系統排程時放行。

## 3. 通知型別擴充

`starting_soon` 之前留給本階段。加入：
- notifications 的 `type` check 清單新增 `starting_soon`。
- `lib/types.ts` 的 `NotificationType` 聯集新增 `starting_soon`。
- `lib/notifications-logic.ts` 的 `notificationMessage` 新增：`starting_soon` → 「活動即將開始：{title}」。

## 4. 資料 / 函式層（migration 0010）

### 4.1 notifications type 擴充
```sql
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('registered','waitlisted','promoted','moderation_approved','moderation_rejected','starting_soon'));
```

### 4.2 守門 trigger 加系統旁路
重建 `guard_event_status`，在最前面放行系統操作：
```sql
create or replace function public.guard_event_status() returns trigger
language plpgsql security definer as $$
begin
  if coalesce(current_setting('app.system_op', true), '') = 'on' then return new; end if;
  if public.is_admin() then return new; end if;
  if new.status is distinct from old.status then
    if not (old.status = 'rejected' and new.status = 'pending') then
      raise exception 'not allowed to change event status';
    end if;
  end if;
  return new;
end; $$;
```
（其餘既有行為不變。）

### 4.3 expire_past_events()
```sql
create or replace function public.expire_past_events() returns int
language plpgsql security definer as $$
declare v_count int;
begin
  perform set_config('app.system_op', 'on', true);  -- 本交易內旁路守門
  update public.events set status = 'ended'
    where status = 'published' and end_at < now();
  get diagnostics v_count = row_count;
  return v_count;
end; $$;
```

### 4.4 notify_upcoming_events()
```sql
create or replace function public.notify_upcoming_events() returns int
language plpgsql security definer as $$
declare v_count int := 0; r record;
begin
  for r in
    select reg.user_id, e.id as event_id
    from public.events e
    join public.registrations reg on reg.event_id = e.id and reg.status = 'registered'
    where e.status = 'published'
      and e.start_at > now()
      and e.start_at <= now() + interval '24 hours'
      and not exists (
        select 1 from public.notifications n
        where n.user_id = reg.user_id
          and n.type = 'starting_soon'
          and n.payload->>'eventId' = e.id::text
      )
  loop
    perform public.notify(r.user_id, 'starting_soon', r.event_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end; $$;
```

### 4.5 pg_cron 排程
```sql
create extension if not exists pg_cron;
select cron.unschedule('expire-past-events') where exists (select 1 from cron.job where jobname = 'expire-past-events');
select cron.unschedule('notify-upcoming-events') where exists (select 1 from cron.job where jobname = 'notify-upcoming-events');
select cron.schedule('expire-past-events', '*/15 * * * *', 'select public.expire_past_events()');
select cron.schedule('notify-upcoming-events', '*/15 * * * *', 'select public.notify_upcoming_events()');
```
> 排程頻率每 15 分鐘。若本機 pg_cron 擴充啟用細節有異，於 plan 處理（測試針對函式，不依賴排程實際觸發）。

## 5. 測試（整合，真 DB — 直接呼叫函式）

- **expire_past_events**：
  - published 且 `end_at < now()` → 呼叫後 `status='ended'`（同時證明系統旁路讓守門放行）。
  - published 且 `end_at` 未來 → 不變。
  - 已是 ended/其他狀態 → 不受影響。
- **notify_upcoming_events**：
  - published、`start_at` 在 24h 內、有 registered 報名者 → 呼叫後該報名者得到一則 `starting_soon`。
  - 再次呼叫 → 不重複（仍只有一則）。
  - `start_at` > 24h → 不發。
  - waitlist 報名者 → 不發（只發 registered）。
- **純函式**：`notificationMessage('starting_soon', {eventTitle})` → 「活動即將開始：{title}」。

## 6. 範圍界線（本階段不做）

- 無 UI（背景工作；通知自動出現在既有 2d 鈴鐺）。
- Banner 自動刷新 → 2e。
- Email／推播 → 排除項。

## 7. 未解 / 實作時決定

- pg_cron 擴充在本機 Supabase 的啟用方式（`create extension` 是否足夠，或需 config.toml），plan 時確認；若本機無法啟用排程，migration 的 cron 部分可容錯（函式與測試仍完整）。
- 排程頻率（目前 15 分鐘）可日後調整。
