-- 公開計數（僅聚合，不外洩個別報名者）。以 view 擁有者權限運作，繞過 registrations RLS。
create view public.event_registered_counts as
  select event_id, count(*)::int as registered_count
  from public.registrations
  where status = 'registered'
  group by event_id;
grant select on public.event_registered_counts to anon, authenticated;

-- 本人對某活動的報名狀態 + 候補序位（definer：可讀他人 waitlist 以算序位，但只回傳本人資訊）
create or replace function public.get_my_registration(p_event_id uuid)
returns table (status text, waitlist_position int)
language plpgsql security definer as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
  v_created timestamptz;
  v_pos int;
begin
  if v_uid is null then return; end if;
  select r.status, r.created_at into v_status, v_created
    from public.registrations r
    where r.event_id = p_event_id and r.user_id = v_uid and r.status <> 'cancelled';
  if v_status is null then return; end if;
  if v_status = 'waitlist' then
    select count(*) + 1 into v_pos from public.registrations r
      where r.event_id = p_event_id and r.status = 'waitlist' and r.created_at < v_created;
  end if;
  status := v_status; waitlist_position := v_pos; return next;
end; $$;
grant execute on function public.get_my_registration(uuid) to anon, authenticated;
