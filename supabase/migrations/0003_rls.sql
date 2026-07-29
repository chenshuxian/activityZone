-- Row Level Security policies for profiles, categories, events, event_categories.

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.events enable row level security;
alter table public.event_categories enable row level security;

-- admin 判斷輔助函式
create or replace function public.is_admin() returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- profiles：本人可讀寫自己；admin 可讀全部
create policy profiles_self_read on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy profiles_self_upsert on public.profiles
  for insert with check (id = auth.uid());
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid());

-- categories：任何人可讀；僅 admin 可寫
create policy categories_public_read on public.categories
  for select using (true);
create policy categories_admin_write on public.categories
  for all using (public.is_admin()) with check (public.is_admin());

-- events：已上架任何人可讀；本人可讀自己所有狀態；admin 可讀全部
create policy events_read on public.events
  for select using (
    status = 'published'
    or organizer_id = auth.uid()
    or public.is_admin()
  );
create policy events_insert on public.events
  for insert with check (
    organizer_id = auth.uid()
    and (public.is_admin() or status in ('draft','pending'))
  );
create policy events_update on public.events
  for update using (organizer_id = auth.uid() or public.is_admin())
  with check (
    public.is_admin()
    or (organizer_id = auth.uid() and status in ('draft','pending'))
  );

-- event_categories：跟隨可見的 event
create policy event_categories_read on public.event_categories
  for select using (
    exists (select 1 from public.events e where e.id = event_id
            and (e.status = 'published' or e.organizer_id = auth.uid() or public.is_admin()))
  );
create policy event_categories_write on public.event_categories
  for all using (
    exists (select 1 from public.events e where e.id = event_id
            and (e.organizer_id = auth.uid() or public.is_admin()))
  ) with check (
    exists (select 1 from public.events e where e.id = event_id
            and (e.organizer_id = auth.uid() or public.is_admin()))
  );

-- Table grants: CLI migrations run as `postgres`, whose default ACL does not
-- grant DML to anon/authenticated/service_role. RLS policies above narrow
-- what's visible per-row, but the table-level grants below are still required
-- (service_role bypasses RLS entirely but still needs table grants).
grant select on public.events, public.event_categories to anon;
grant select, insert, update, delete on
  public.profiles, public.events, public.event_categories, public.categories
  to authenticated;
grant all on
  public.profiles, public.events, public.event_categories, public.categories
  to service_role;
