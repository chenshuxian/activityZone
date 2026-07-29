# 階段 2a · 報名 + 候補 · 設計文件（Spec）

- 日期：2026-07-29
- 狀態：設計確認中
- 隸屬：階段 2 的第一個子系統。上層產品 spec：`docs/superpowers/specs/2026-07-28-local-events-platform-design.md`
- 前置：階段 1（核心）已完成並合併（events / profiles / categories / RLS / 審核 / 首頁 / 詳情 / 發布）。

## 1. 目標

讓登入會員能在活動詳情頁「站內報名」，含名額上限、額滿候補、報名截止、隨時取消並自動遞補。不涉金流。

## 2. 已定案的規則

- **名額計算**：一筆報名 = 1 個名額。`party_size`（同行人數）僅為給主辦方參考的資訊，不影響名額扣抵。
- **取消時限**：活動開始前（`start_at` 之前）都可取消；取消 `registered` 若有候補則自動遞補最早的一位。
- **併發正確性**：報名/取消以 Postgres RPC 函式（交易 + 行鎖）原子完成，避免超賣。
- **報名欄位**：主辦方以開關決定收哪些（同行人數 / 聯絡電話 / 備註，各為 關/選填/必填），存於 `events.registration_fields`。

## 3. 資料模型

### 新增 `registrations` 表
- `id uuid pk default gen_random_uuid()`
- `event_id uuid not null → events(id) on delete cascade`
- `user_id uuid not null → profiles(id) on delete cascade`
- `status text not null check (status in ('registered','waitlist','cancelled'))`
- `party_size int not null default 1 check (party_size >= 1)`
- `form_answers jsonb not null default '{}'`（電話、備註等額外答案）
- `created_at timestamptz not null default now()`（候補排序依據）
- **部分唯一索引**：`unique (event_id, user_id) where status <> 'cancelled'`
  - 一位使用者對一個活動只能有一筆有效（registered/waitlist）報名；取消後（cancelled）可重新報名。
- 索引：`(event_id, status, created_at)`（供計數與候補排序）。

### `events.registration_fields`（既有欄位，本階段開始使用）
JSON 設定，例：
```json
{ "party_size": "optional", "phone": "required", "note": "off" }
```
值為 `off` | `optional` | `required`。

## 4. RPC 函式（`SECURITY DEFINER`，原子）

### `register_for_event(p_event_id uuid, p_party_size int, p_form_answers jsonb) returns text`
在單一交易內：
1. `select ... from events where id = p_event_id for update`（鎖定該活動列）。
2. 驗證活動存在且 `status = 'published'`；否則 raise。
3. 驗證 `now() < start_at`；且若有 `registration_deadline` 則 `now() < registration_deadline`；否則 raise（報名已截止）。
4. 若使用者已有非 cancelled 報名 → raise（重複報名）。
5. 計算 `registered` 筆數。`capacity is null` 或 `count < capacity` → 新增狀態 `registered`；否則 `waitlist`。
6. insert，回傳最終狀態（`'registered'` | `'waitlist'`）。
- 以 `auth.uid()` 作為 `user_id`（函式內取，不信任前端傳入）。

### `cancel_registration(p_event_id uuid) returns uuid`
在單一交易內：
1. 鎖定該活動列。
2. 找出 `auth.uid()` 對該活動的有效報名；無則 raise。
3. 記下其原狀態，將該報名設為 `cancelled`。
4. 若原狀態為 `registered`，找最早 `created_at` 的 `waitlist`，將其升為 `registered`，回傳被遞補者的 `user_id`（供 2d 發通知）；否則回傳 null。
- 取消不限截止，只要活動未開始（於呼叫端與函式內皆檢查 `now() < start_at`）。

> 這兩個函式封裝所有計數/候補邏輯，Server Action 只做薄封裝與錯誤訊息轉譯。

## 5. RLS（`registrations`）

- **select**：`user_id = auth.uid()`（本人）或該活動的 `organizer_id = auth.uid()`（主辦方看自己活動的名單）或 `is_admin()`。
- **insert/update**：一般使用者不直接寫；透過 RPC（`SECURITY DEFINER`）進行。仍加保守政策：`user_id = auth.uid()` 才可 insert/update 自己的列（RPC 以 definer 權限運作，不受此限）。
- 需為 `anon`/`authenticated`/`service_role` 補對應 table grants（同階段 1 的作法）。
- **名單隱私**：會員 A 看不到會員 B 活動的報名者——資料庫層級把關。

## 6. Server 層

- `lib/events/registration.ts`（server action，`'use server'`）：
  - `register(eventId, input)` → 呼叫 `register_for_event` RPC；回傳 `{ ok, status }` 或 `{ ok:false, error }`。
  - `cancelRegistration(eventId)` → 呼叫 `cancel_registration` RPC；回傳 `{ ok, promotedUserId }`。
- 純邏輯輔助（可單元測試、無 server-only 匯入）置於 `lib/events/registration-logic.ts`，例如把 `registration_fields` 設定解析成「要顯示哪些欄位、哪些必填」的函式 `parseRegistrationFields(config)`。

## 7. 讀取面調整

- `getEventById` 併回：
  - `registeredCount`（該活動 `registered` 筆數）
  - `myRegistration`（目前登入者對該活動的報名狀態與候補序位，未登入為 null）
- `listPublishedEvents` 併回各活動 `registeredCount`，供卡片顯示「剩 N 位 / 已額滿」（capacity 為 null 則顯示不限）。
  - 實作以 SQL view 或聚合查詢；避免 N+1。

## 8. UI

### 活動詳情頁 · 報名狀態機
| 情境 | 顯示 |
|---|---|
| 未登入 | 「登入後報名」→ 觸發 Google 登入 |
| 可報名 | 依 `registration_fields` 顯示欄位 + 「我要報名」按鈕 |
| 已報名（registered） | 「已報名」狀態 +「取消報名」|
| 候補中（waitlist） | 「候補中（第 N 位）」+「取消候補」|
| 已額滿（未報名） | 「已額滿，加入候補」|
| 過報名截止 | 停用，顯示「報名已截止」|
| 活動已開始/結束 | 停用，顯示「活動已結束」|

- 依循既有設計系統（`components/ui`：Button、Chip；token 色彩；亮/暗）。
- 報名欄位表單為詳情頁上的區塊或 modal；欄位由 `parseRegistrationFields` 決定。

### 發布/編輯活動表單
新增三個欄位設定開關（同行人數 / 聯絡電話 / 備註，各：關 / 選填 / 必填），寫入 `registration_fields`。沿用 Phase 1 的 `EventForm` 與 `createEvent`（`createEvent` 補寫 `registration_fields`）。

## 9. 測試

- **RPC 整合測試（真 DB）**：
  - 未滿 → registered；滿 → waitlist；不限名額 → 皆 registered。
  - 取消 registered → 最早候補遞補為 registered，回傳其 id。
  - 取消 waitlist → 不影響他人。
  - 重複報名被擋；過 `registration_deadline` 被擋；活動已開始被擋。
  - **併發**：兩個連線同時搶最後一位，只有一位 registered、另一位 waitlist（驗證行鎖）。
- **純邏輯單元測試**：`parseRegistrationFields` 各組態；候補序位計算。
- **RLS 測試**：本人可讀自己報名；他人讀不到；主辦方可讀自己活動名單；非主辦方讀不到。
- **UI 元件測試**：報名區塊在各狀態的顯示。

## 10. 範圍界線（本階段不做）

- **發送通知**：屬 2d。`cancel_registration` 回傳被遞補者 id 備用；2a 不建立 notifications 表、不發通知。
- **報名名單匯出 CSV / 主辦方後台**：屬 2c。2a 僅確保 RLS 讓主辦方「能查到」自己活動的報名資料。
- 金流、Email、推播：非階段 2 範圍。

## 11. 未解 / 實作時決定

- 「剩 N 位」計數以 SQL view 或查詢聚合實作，細節於 plan 決定。
- 報名表單以「詳情頁內嵌區塊」或「modal」呈現，plan 時定（傾向內嵌，較簡單）。
