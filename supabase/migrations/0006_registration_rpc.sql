-- 報名：原子檢查名額並決定 registered / waitlist
create or replace function public.register_for_event(
  p_event_id uuid, p_party_size int default 1, p_form_answers jsonb default '{}'
) returns text
language plpgsql security definer as $$
declare
  v_event public.events;
  v_uid uuid := auth.uid();
  v_count int;
  v_status text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select * into v_event from public.events where id = p_event_id for update;
  if not found or v_event.status <> 'published' then
    raise exception 'event not available';
  end if;
  if now() >= v_event.start_at then raise exception 'event already started'; end if;
  if v_event.registration_deadline is not null and now() >= v_event.registration_deadline then
    raise exception 'registration closed';
  end if;
  if exists (select 1 from public.registrations
             where event_id = p_event_id and user_id = v_uid and status <> 'cancelled') then
    raise exception 'already registered';
  end if;

  select count(*) into v_count from public.registrations
    where event_id = p_event_id and status = 'registered';
  if v_event.capacity is null or v_count < v_event.capacity then
    v_status := 'registered';
  else
    v_status := 'waitlist';
  end if;

  insert into public.registrations (event_id, user_id, status, party_size, form_answers)
    values (p_event_id, v_uid, v_status, greatest(coalesce(p_party_size,1),1), coalesce(p_form_answers,'{}'));
  return v_status;
end; $$;

-- 取消：若原為 registered 且有候補，遞補最早一位，回傳被遞補者 id
create or replace function public.cancel_registration(p_event_id uuid)
returns uuid
language plpgsql security definer as $$
declare
  v_uid uuid := auth.uid();
  v_event public.events;
  v_prev text;
  v_promoted uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select * into v_event from public.events where id = p_event_id for update;
  if not found then raise exception 'event not found'; end if;
  if now() >= v_event.start_at then raise exception 'event already started'; end if;

  select status into v_prev from public.registrations
    where event_id = p_event_id and user_id = v_uid and status <> 'cancelled'
    for update;
  if v_prev is null then raise exception 'no active registration'; end if;
  update public.registrations set status = 'cancelled'
    where event_id = p_event_id and user_id = v_uid and status <> 'cancelled';

  if v_prev = 'registered' then
    update public.registrations set status = 'registered'
      where id = (
        select id from public.registrations
        where event_id = p_event_id and status = 'waitlist'
        order by created_at asc limit 1
      )
      returning user_id into v_promoted;
  end if;
  return v_promoted;
end; $$;

grant execute on function public.register_for_event(uuid,int,jsonb) to authenticated;
grant execute on function public.cancel_registration(uuid) to authenticated;
