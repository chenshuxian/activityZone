create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, event_id)
);
create index favorites_user_created_idx on public.favorites (user_id, created_at desc);

alter table public.favorites enable row level security;
create policy favorites_read on public.favorites for select using (user_id = auth.uid());
create policy favorites_insert on public.favorites for insert with check (user_id = auth.uid());
create policy favorites_delete on public.favorites for delete using (user_id = auth.uid());
grant select, insert, delete on public.favorites to authenticated;
grant all on public.favorites to service_role;
