-- Baseline grants (not RLS): migrations run as the `postgres` role, whose
-- default ACL on schema public does not include SELECT for anon/authenticated
-- (unlike Studio-run SQL, which executes as supabase_admin). Without this,
-- the anon/authenticated keys get "permission denied" even with RLS disabled.
-- Task 2 will introduce RLS policies; grants for other tables can be added
-- there as needed.
grant usage on schema public to anon, authenticated;
grant select on public.categories to anon, authenticated;
