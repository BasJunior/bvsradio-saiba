-- Immutable report versions. Server APIs authorize staff writes and owner reads.
create table public.distribution_reports (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.releases(id) on delete cascade,
  artist_user_id uuid not null references public.profiles(id) on delete cascade,
  period_start date not null,
  period_end date not null check (period_end >= period_start),
  source text not null check (source = 'amuse'),
  source_reference text not null check (length(source_reference) between 1 and 300),
  daily jsonb not null check (jsonb_typeof(daily) = 'array'),
  countries jsonb not null check (jsonb_typeof(countries) = 'array'),
  created_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now()
);
create index distribution_reports_owner_release_date on public.distribution_reports (artist_user_id, release_id, updated_at desc);
alter table public.distribution_reports enable row level security;
revoke all on public.distribution_reports from anon, authenticated;
grant select, insert on public.distribution_reports to service_role;
comment on table public.distribution_reports is 'Partner analytics snapshots, not royalty statements. Corrections append versions; do not sum overlapping snapshots.';
notify pgrst, 'reload schema';
