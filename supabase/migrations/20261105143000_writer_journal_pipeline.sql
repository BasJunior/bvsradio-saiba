-- Extend the EXISTING creator-workflows schema; do not create parallel article tables.
-- Prerequisite: supabase-creator-workflows.sql (writer_applications and editorial_articles).
alter table public.editorial_articles add column if not exists cover_art_path text;
create index if not exists editorial_articles_published_recent_idx
  on public.editorial_articles (published_at desc) where status = 'published';

-- All writer/admin mutations run through authenticated Next route handlers with
-- service-role credentials and explicit ownership/status checks. The prior FOR ALL
-- browser policies let a writer set status='published' directly via Supabase JS.
drop policy if exists "writers own application" on public.writer_applications;
drop policy if exists "writers own articles" on public.editorial_articles;
create policy "writers read own application" on public.writer_applications
  for select to authenticated using (auth.uid() = user_id);
create policy "writers read own articles" on public.editorial_articles
  for select to authenticated using (auth.uid() = author_id);
revoke insert, update, delete on public.writer_applications from anon, authenticated;
revoke insert, update, delete on public.editorial_articles from anon, authenticated;

comment on column public.editorial_articles.cover_art_path is
  'Private R2 writer-covers key; public proxy allows it only while article is published.';
