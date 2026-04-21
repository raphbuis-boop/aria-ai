-- ============================================================================
-- Private Supabase storage bucket for custom BBA templates + signed PDFs.
--
-- All reads/writes through the app go via the service-role admin client in
-- API routes (auth-checked), so we don't need storage RLS policies here.
-- The bucket is private to prevent unauthenticated HTTP enumeration.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('bba-templates', 'bba-templates', false)
on conflict (id) do nothing;
