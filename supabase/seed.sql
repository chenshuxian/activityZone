insert into public.categories (name, slug, icon) values
  ('音樂','music','🎵'),
  ('親子','family','👨‍👩‍👧'),
  ('手作','craft','🧵'),
  ('體育','sports','🏃'),
  ('飲食','food','🍜'),
  ('廟會','temple','🎏'),
  ('課程','course','📚'),
  ('抽獎','lottery','🎁')
on conflict (slug) do nothing;
