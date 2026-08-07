-- 新增分類：課程、抽獎（冪等）
insert into public.categories (name, slug, icon) values
  ('課程','course','📚'),
  ('抽獎','lottery','🎁')
on conflict (slug) do nothing;
