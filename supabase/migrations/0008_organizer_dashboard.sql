-- 放寬編輯：主辦方可更新自己活動的內容（不論狀態）；status 由下方 trigger 治理
drop policy if exists events_update on public.events;
create policy events_update on public.events
  for update using (organizer_id = auth.uid() or public.is_admin())
  with check (organizer_id = auth.uid() or public.is_admin());

-- 狀態守門：非 admin 不得變更 status，唯一例外 rejected -> pending（重新送審）
create or replace function public.guard_event_status() returns trigger
language plpgsql security definer as $$
begin
  if public.is_admin() then return new; end if;
  if new.status is distinct from old.status then
    if not (old.status = 'rejected' and new.status = 'pending') then
      raise exception 'not allowed to change event status';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists events_guard_status on public.events;
create trigger events_guard_status
  before update on public.events
  for each row execute function public.guard_event_status();

-- 報名名單（僅該活動主辦方/admin 可呼叫）
create or replace function public.get_event_registrations(p_event_id uuid)
returns table (
  user_id uuid, display_name text, email text, status text,
  party_size int, form_answers jsonb, created_at timestamptz
)
language plpgsql security definer as $$
begin
  if not exists (
    select 1 from public.events e
    where e.id = p_event_id and (e.organizer_id = auth.uid() or public.is_admin())
  ) then
    raise exception 'not authorized';
  end if;
  return query
    select r.user_id, p.display_name, u.email::text, r.status,
           r.party_size, r.form_answers, r.created_at
    from public.registrations r
    join public.profiles p on p.id = r.user_id
    left join auth.users u on u.id = r.user_id
    where r.event_id = p_event_id and r.status <> 'cancelled'
    order by (r.status = 'waitlist'), r.created_at;
end; $$;
grant execute on function public.get_event_registrations(uuid) to authenticated;
