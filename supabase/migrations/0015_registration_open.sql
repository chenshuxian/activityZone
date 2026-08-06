-- 活動可選擇是否開放線上報名（關閉＝純佈告欄，只顯示資訊不顯示報名鈕）
alter table public.events
  add column registration_open boolean not null default true;
