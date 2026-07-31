-- 1) notifications type 擴充：加入 starting_soon
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('registered','waitlisted','promoted','moderation_approved','moderation_rejected','starting_soon'));

-- 2) 守門 trigger 加系統操作旁路（其餘行為不變）
create or replace function public.guard_event_status() returns trigger
language plpgsql security definer as $$
begin
  if coalesce(current_setting('app.system_op', true), '') = 'on' then return new; end if;
  if public.is_admin() then return new; end if;
  if new.status is distinct from old.status then
    if not (old.status = 'rejected' and new.status = 'pending') then
      raise exception 'not allowed to change event status';
    end if;
  end if;
  return new;
end; $$;

-- 3) 過期活動 → ended（設 app.system_op 旁路守門）
create or replace function public.expire_past_events() returns int
language plpgsql security definer as $$
declare v_count int;
begin
  perform set_config('app.system_op', 'on', true);
  update public.events set status = 'ended'
    where status = 'published' and end_at < now();
  get diagnostics v_count = row_count;
  return v_count;
end; $$;

-- 4) 開始前 24h 通知 registered 報名者（去重）
create or replace function public.notify_upcoming_events() returns int
language plpgsql security definer as $$
declare v_count int := 0; r record;
begin
  for r in
    select reg.user_id, e.id as event_id
    from public.events e
    join public.registrations reg on reg.event_id = e.id and reg.status = 'registered'
    where e.status = 'published'
      and e.start_at > now()
      and e.start_at <= now() + interval '24 hours'
      and not exists (
        select 1 from public.notifications n
        where n.user_id = reg.user_id
          and n.type = 'starting_soon'
          and n.payload->>'eventId' = e.id::text
      )
  loop
    perform public.notify(r.user_id, 'starting_soon', r.event_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end; $$;
grant execute on function public.expire_past_events() to service_role;
grant execute on function public.notify_upcoming_events() to service_role;

-- 5) pg_cron 排程（容錯：本機若無 pg_cron 不致使 migration 失敗）
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule('expire-past-events') where exists (select 1 from cron.job where jobname = 'expire-past-events');
  perform cron.unschedule('notify-upcoming-events') where exists (select 1 from cron.job where jobname = 'notify-upcoming-events');
  perform cron.schedule('expire-past-events', '*/15 * * * *', 'select public.expire_past_events()');
  perform cron.schedule('notify-upcoming-events', '*/15 * * * *', 'select public.notify_upcoming_events()');
exception when others then
  raise notice 'pg_cron scheduling skipped: %', sqlerrm;
end $$;
