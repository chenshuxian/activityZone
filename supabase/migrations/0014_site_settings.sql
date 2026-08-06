-- 單列站台設定（首頁 Hero）
create table public.site_settings (
  id int primary key default 1 check (id = 1),
  hero_title text not null default '發現你附近的每一場精彩',
  hero_subtitle text not null default '在地活動，一次看盡。依地區與興趣，為你推薦。',
  hero_image text,
  updated_at timestamptz not null default now()
);
insert into public.site_settings (id) values (1) on conflict (id) do nothing;

alter table public.site_settings enable row level security;
create policy site_settings_public_read on public.site_settings for select using (true);
create policy site_settings_admin_write on public.site_settings for all
  using (public.is_admin()) with check (public.is_admin());
grant select on public.site_settings to anon, authenticated;
grant update on public.site_settings to authenticated;
grant all on public.site_settings to service_role;
