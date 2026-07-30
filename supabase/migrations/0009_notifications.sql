create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('registered','waitlisted','promoted','moderation_approved','moderation_rejected')),
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;
create policy notifications_read on public.notifications for select using (user_id = auth.uid());
create policy notifications_update on public.notifications for update using (user_id = auth.uid());
grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;

create or replace function public.notify(p_user uuid, p_type text, p_event uuid, p_reason text default null)
returns void language plpgsql security definer as $$
declare v_title text;
begin
  select title into v_title from public.events where id = p_event;
  insert into public.notifications (user_id, type, payload)
  values (p_user, p_type,
    jsonb_build_object('eventId', p_event, 'eventTitle', coalesce(v_title,''))
      || case when p_reason is not null then jsonb_build_object('reason', p_reason) else '{}'::jsonb end);
end; $$;

create or replace function public.notify_on_registration_insert() returns trigger
language plpgsql security definer as $$
begin
  if new.status = 'registered' then perform public.notify(new.user_id,'registered',new.event_id);
  elsif new.status = 'waitlist' then perform public.notify(new.user_id,'waitlisted',new.event_id);
  end if;
  return new;
end; $$;
create trigger notifications_on_registration_insert
  after insert on public.registrations for each row execute function public.notify_on_registration_insert();

create or replace function public.notify_on_registration_update() returns trigger
language plpgsql security definer as $$
begin
  if old.status = 'waitlist' and new.status = 'registered' then
    perform public.notify(new.user_id,'promoted',new.event_id);
  end if;
  return new;
end; $$;
create trigger notifications_on_registration_update
  after update on public.registrations for each row execute function public.notify_on_registration_update();

create or replace function public.notify_on_event_moderation() returns trigger
language plpgsql security definer as $$
begin
  if old.status = 'pending' and new.status = 'published' then
    perform public.notify(new.organizer_id,'moderation_approved',new.id);
  elsif new.status = 'rejected' and old.status is distinct from 'rejected' then
    perform public.notify(new.organizer_id,'moderation_rejected',new.id,new.reject_reason);
  end if;
  return new;
end; $$;
create trigger notifications_on_event_moderation
  after update on public.events for each row execute function public.notify_on_event_moderation();
