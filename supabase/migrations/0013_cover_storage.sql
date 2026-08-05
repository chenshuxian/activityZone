insert into storage.buckets (id, name, public)
  values ('event-covers', 'event-covers', true)
  on conflict (id) do nothing;

create policy "event-covers upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'event-covers' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "event-covers update own" on storage.objects for update to authenticated
  using (bucket_id = 'event-covers' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "event-covers delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'event-covers' and (storage.foldername(name))[1] = auth.uid()::text);
