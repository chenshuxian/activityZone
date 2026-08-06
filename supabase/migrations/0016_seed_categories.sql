-- 分類為全站參考資料，各環境皆需，故以 migration 灌入（冪等）
insert into public.categories (name, slug, icon) values
  ('音樂','music','🎵'),
  ('親子','family','👨‍👩‍👧'),
  ('手作','craft','🧵'),
  ('體育','sports','🏃'),
  ('飲食','food','🍜'),
  ('廟會','temple','🎏')
on conflict (slug) do nothing;
