create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('registered','waitlist','cancelled')),
  party_size int not null default 1 check (party_size >= 1),
  form_answers jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create unique index registrations_active_uniq
  on public.registrations (event_id, user_id)
  where status <> 'cancelled';

create index registrations_event_status_idx
  on public.registrations (event_id, status, created_at);

alter table public.registrations enable row level security;

create policy registrations_read on public.registrations
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid())
    or public.is_admin()
  );
create policy registrations_insert on public.registrations
  for insert with check (user_id = auth.uid());
create policy registrations_update on public.registrations
  for update using (user_id = auth.uid());

grant select, insert, update on public.registrations to authenticated;
grant select on public.registrations to anon;
grant all on public.registrations to service_role;
