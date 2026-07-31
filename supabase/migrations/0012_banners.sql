create table public.banners (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events(id) on delete cascade,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index banners_active_sort_idx on public.banners (active, sort_order);

alter table public.banners enable row level security;
create policy banners_public_read on public.banners for select using (true);
create policy banners_admin_write on public.banners for all
  using (public.is_admin()) with check (public.is_admin());
grant select on public.banners to anon, authenticated;
grant insert, update, delete on public.banners to authenticated;
grant all on public.banners to service_role;
