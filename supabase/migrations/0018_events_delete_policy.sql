-- 允許管理員或活動主辦者刪除活動（含已上架）。子表皆 on delete cascade。
create policy events_delete on public.events for delete
  using (public.is_admin() or organizer_id = auth.uid());
