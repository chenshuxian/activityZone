# 階段 2c · 主辦方後台 + 報名名單匯出 · 設計文件（Spec）

- 日期：2026-07-30
- 狀態：設計確認中
- 隸屬：階段 2 子系統。上層產品 spec：`docs/superpowers/specs/2026-07-28-local-events-platform-design.md`；報名系統 spec：`docs/superpowers/specs/2026-07-29-phase2a-registration-design.md`
- 前置：階段 1（核心）、設計系統、階段 2a（報名+候補）皆已完成並合併。

## 1. 目標

讓主辦方（發過活動的會員）有一個後台：管理自己的活動、編輯內容、檢視與匯出（CSV）各活動的報名名單。管理員可管理全部。

## 2. 已定案的規則

- **編輯權限**：主辦方可隨時編輯自己活動的「內容」欄位（含已上架，方便修錯字/更新）；但**不得變更 `status`**（上架/審核狀態只由管理員或系統改）。唯一例外：`rejected → pending`（退回後重新送審）。
- **狀態守門**：以資料庫 trigger 強制上述規則（非僅前端）。
- **名單隱私**：報名者個資受 RLS 保護；名單經一支「僅該活動主辦方/管理員可呼叫」的 `SECURITY DEFINER` 函式提供。
- **名單含 email**：主辦方常需聯絡報名者，名單含報名者登入 email（由函式讀 `auth.users` 提供，僅該活動主辦方可見）。
- **後台路徑**：`/dashboard`。

## 3. 資料 / 權限層（migration 0008）

### 放寬 events 編輯 RLS
將 `events_update` 政策的 `with check` 改為：
```sql
with check (organizer_id = auth.uid() or public.is_admin())
```
（移除原本「非 admin 只能 draft/pending」的 with-check 限制——改由下方 trigger 治理 status。）

### 狀態守門 trigger
```sql
create or replace function public.guard_event_status() returns trigger
language plpgsql security definer as $$
begin
  if public.is_admin() then return new; end if;
  if new.status is distinct from old.status then
    -- 非管理員唯一允許的自我狀態轉移：退回後重新送審
    if not (old.status = 'rejected' and new.status = 'pending') then
      raise exception 'not allowed to change event status';
    end if;
  end if;
  return new;
end; $$;
create trigger events_guard_status
  before update on public.events
  for each row execute function public.guard_event_status();
```
> 註：`events_insert` 政策維持不變（非 admin 仍只能以 draft/pending 建立），本階段不動。

### 報名名單函式（SECURITY DEFINER）
```sql
create or replace function public.get_event_registrations(p_event_id uuid)
returns table (
  user_id uuid, display_name text, email text, status text,
  party_size int, form_answers jsonb, created_at timestamptz
)
language plpgsql security definer as $$
begin
  if not exists (
    select 1 from public.events e
    where e.id = p_event_id and (e.organizer_id = auth.uid() or public.is_admin())
  ) then
    raise exception 'not authorized';
  end if;
  return query
    select r.user_id, p.display_name, u.email::text, r.status,
           r.party_size, r.form_answers, r.created_at
    from public.registrations r
    join public.profiles p on p.id = r.user_id
    left join auth.users u on u.id = r.user_id
    where r.event_id = p_event_id and r.status <> 'cancelled'
    order by (r.status = 'waitlist'), r.created_at;  -- registered 先、再 waitlist，各依時間
end; $$;
grant execute on function public.get_event_registrations(uuid) to authenticated;
```

## 4. Server 層

- `lib/events/actions.ts` 新增 `updateEvent(eventId, input)`：更新自己活動的可編欄位（title/description/cover/organizer_name/contact_info/is_free/fee_note/city/district/address/start_at/end_at/registration_deadline/capacity/registration_fields/categoryIds）。**不寫 status**。重用 `validateEventInput`。同步更新 `event_categories`（先刪後插或差集）。
- `lib/events/queries.ts`（或新檔 `lib/events/dashboard.ts`）：
  - `getMyEvents()`：回目前登入者主辦的活動，含 `registeredCount` 與 `waitlistCount`、status、start_at 等（供後台列表）。
  - `getEventForEdit(eventId)`：回單一活動的完整可編欄位（供預填；僅本人/admin，靠 RLS）。
- `lib/events/registrations-admin.ts`（server）：`getEventRegistrations(eventId)` → 呼叫 `get_event_registrations` RPC，回結構化名單。
- `lib/events/csv.ts`（純函式，可單元測試）：`toRegistrationsCsv(rows)` → 產生 CSV 字串（含表頭、跳脫逗號/引號/換行）。

## 5. 頁面與路由

- **`/dashboard`（主辦方後台，server component，未登入導向 `/`）**：
  - 列出 `getMyEvents()`：每列顯示 標題、狀態徽章（草稿/待審核/已上架/退回/已結束）、日期、`正取 N / 名額 M`（或不限）、`候補 K`。
  - 每列動作：**編輯**（→ `/events/[id]/edit`）、**報名名單**（→ `/events/[id]/registrations`）。
  - 沿用設計系統（token、Chip、卡片/表格樣式）。
- **`/events/[id]/edit`（編輯頁，server gate：僅本人或 admin）**：沿用 `EventForm`，加「編輯模式」——預填現有值、送出改呼叫 `updateEvent`、成功導回 `/dashboard`。
- **`/events/[id]/registrations`（名單頁，server gate：僅本人或 admin）**：
  - 表格：顯示名稱、email、狀態（正取/候補）、同行人數、額外欄位（電話/備註）、報名時間。
  - **「匯出 CSV」** 按鈕 → 連到 CSV route handler。
- **CSV route handler**：`app/events/[id]/registrations/export/route.ts`（GET）：驗證登入 → 呼叫 `getEventRegistrations` → `toRegistrationsCsv` → 回 `text/csv`（`Content-Disposition: attachment; filename="registrations-<id>.csv"`）。RLS/函式已保證只有主辦方/admin 拿得到資料。
- **Header**：登入後多顯示「我的活動」連結 → `/dashboard`。

## 6. EventForm 編輯模式

`EventForm` 目前僅建立（呼叫 `createEvent`）。改為接受選用 props：
- `initial?: EventFormValues`（預填值；編輯時帶入）
- `mode: 'create' | 'edit'` 與對應的送出行為（edit 時呼叫 `updateEvent(eventId, ...)`）。
保持單一元件、欄位不重複；若 edit 分支使檔案過於複雜，可抽出共用欄位子元件（實作時判斷）。

## 7. 測試

- **RLS/trigger（整合，真 DB）**：
  - 主辦方可更新自己「已上架」活動的內容欄位（成功）。
  - 主辦方將自己活動 status 改為其他值 → 被 trigger 擋（例外）。
  - 主辦方 `rejected → pending` 重新送審 → 允許。
  - 管理員可改任意 status。
- **名單函式（整合）**：主辦方呼叫回傳名單（含 email、正取先於候補）；非主辦方呼叫 → 例外。
- **CSV 純函式單元測試**：表頭正確；含逗號/引號/換行的欄位正確跳脫；空名單只有表頭。
- **`getMyEvents`（整合）**：只回自己的活動、計數正確。
- **UI 元件測試**：後台列表狀態徽章與計數顯示；名單表格渲染。

## 8. 範圍界線（本階段不做）

- **發送通知**（審核/遞補/即將開始）：屬 2d。
- **收藏、Banner、排程**：其他子系統。
- 不新增活動封面圖片上傳流程（沿用現況）。

## 9. 未解 / 實作時決定

- `getMyEvents` 的計數以計數 view/聚合實作，細節於 plan 決定（可重用 `event_registered_counts` 並另計 waitlist）。
- 編輯頁的 `event_categories` 更新採「全刪重插」或「差集」，plan 時定（傾向全刪重插，簡單且量小）。
- `EventForm` 編輯模式是否抽共用子元件，實作時視檔案大小決定。
