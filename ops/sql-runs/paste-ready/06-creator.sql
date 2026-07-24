-- ============================================================
-- BVS pack 06-creator
-- Source: supabase-creator-workflows.sql
-- Project: rdwwyolrxahimcgpkzzy
-- Paste entire file into SQL Editor → Run
-- ============================================================

-- BVS writer, research and show/podcast workflows.
-- Run in Supabase SQL editor, then create a private Storage bucket named show-episodes.

create extension if not exists pgcrypto;

create table if not exists public.writer_applications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  bio text not null default '', beats text[] not null default '{}', portfolio_url text,
  status text not null default 'submitted' check (status in ('submitted','approved','rejected','paused')),
  review_notes text, reviewed_by uuid references auth.users(id), reviewed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id)
);

create table if not exists public.editorial_articles (
  id uuid primary key default gen_random_uuid(), author_id uuid not null references auth.users(id) on delete cascade,
  title text not null, slug text, dek text not null default '', body text not null default '', sources jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','submitted','in_review','changes_requested','approved','scheduled','published','rejected')),
  editor_notes text, reviewed_by uuid references auth.users(id), reviewed_at timestamptz, scheduled_for timestamptz, published_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists editorial_articles_slug_unique on public.editorial_articles(slug) where slug is not null;

create table if not exists public.research_briefs (
  id uuid primary key default gen_random_uuid(), created_by uuid not null references auth.users(id), assigned_to uuid references auth.users(id),
  topic text not null, angle text not null default '', source_links jsonb not null default '[]'::jsonb,
  findings text not null default '', seo_suggestions text not null default '',
  status text not null default 'draft' check (status in ('draft','ready_for_review','approved_for_drafting','rejected','archived')),
  reviewed_by uuid references auth.users(id), reviewed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
comment on table public.research_briefs is 'Research assistance only. Approval permits drafting, never autonomous publication.';

create table if not exists public.show_creator_profiles (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, slug text not null unique, description text not null default '', artwork_url text, category text not null default 'Music',
  cadence text not null default 'weekly', status text not null default 'submitted' check (status in ('draft','submitted','approved','rejected','paused')),
  review_notes text, reviewed_by uuid references auth.users(id), reviewed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id, title)
);

create table if not exists public.show_episodes (
  id uuid primary key default gen_random_uuid(), show_id uuid not null references public.show_creator_profiles(id) on delete cascade,
  creator_id uuid not null references auth.users(id) on delete cascade, title text not null, description text not null default '',
  episode_number integer, audio_path text not null, duration_seconds integer, explicit boolean not null default false,
  status text not null default 'submitted' check (status in ('draft','submitted','in_review','changes_requested','approved','scheduled','published','rejected')),
  review_notes text, reviewed_by uuid references auth.users(id), reviewed_at timestamptz, scheduled_for timestamptz, published_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

alter table public.writer_applications enable row level security;
alter table public.editorial_articles enable row level security;
alter table public.research_briefs enable row level security;
alter table public.show_creator_profiles enable row level security;
alter table public.show_episodes enable row level security;

drop policy if exists "writers own application" on public.writer_applications;
create policy "writers own application" on public.writer_applications for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
drop policy if exists "writers own articles" on public.editorial_articles;
create policy "writers own articles" on public.editorial_articles for all using (auth.uid()=author_id) with check (auth.uid()=author_id);
drop policy if exists "assigned research briefs" on public.research_briefs;
create policy "assigned research briefs" on public.research_briefs for select using (auth.uid()=assigned_to or auth.uid()=created_by);
drop policy if exists "creators own shows" on public.show_creator_profiles;
create policy "creators own shows" on public.show_creator_profiles for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
drop policy if exists "creators own episodes" on public.show_episodes;
create policy "creators own episodes" on public.show_episodes for all using (auth.uid()=creator_id) with check (auth.uid()=creator_id);

create index if not exists articles_status_schedule on public.editorial_articles(status, scheduled_for);
create index if not exists episodes_status_schedule on public.show_episodes(status, scheduled_for);
create index if not exists episodes_show_created on public.show_episodes(show_id, created_at desc);
