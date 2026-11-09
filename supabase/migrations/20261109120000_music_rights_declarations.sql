-- Per-upload society declarations, artist grants, staff spot checks and country-level listening.
-- Safe to rerun. Applying this changes no rotation behaviour on its own.

create table if not exists public.music_rights_declarations (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references public.profiles(id) on delete set null,
  release_id uuid references public.releases(id) on delete set null,
  track_id uuid references public.tracks(id) on delete set null,
  society_status text not null check (society_status in ('none', 'member', 'unsure', 'not_declared')),
  society_name text,
  grant_version text,
  grant_accepted_at timestamptz,
  spot_check_result text check (spot_check_result in ('clear', 'found', 'unclear')),
  spot_check_note text,
  spot_checked_by uuid references public.profiles(id) on delete set null,
  spot_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (release_id is not null or track_id is not null)
);

-- A society's written consent, or a BVS licence, recorded by staff.
alter table public.music_rights_declarations
  add column if not exists clearance_basis text check (clearance_basis in ('society_consent', 'bvs_licence')),
  add column if not exists clearance_reference text,
  add column if not exists clearance_recorded_by uuid references public.profiles(id) on delete set null,
  add column if not exists clearance_recorded_at timestamptz;

create unique index if not exists music_rights_declarations_release_key
  on public.music_rights_declarations (release_id) where release_id is not null;
create unique index if not exists music_rights_declarations_track_key
  on public.music_rights_declarations (track_id) where track_id is not null and release_id is null;

alter table public.music_rights_declarations enable row level security;

drop policy if exists "Creators read own rights declarations" on public.music_rights_declarations;
create policy "Creators read own rights declarations" on public.music_rights_declarations
  for select using (owner_user_id = auth.uid());

revoke all on table public.music_rights_declarations from public, anon, authenticated;
grant select on table public.music_rights_declarations to authenticated;
grant select, insert, update on table public.music_rights_declarations to service_role;

-- Country and day only: no listener, session or IP is stored.
create table if not exists public.listener_country_daily (
  day date not null,
  country text not null check (country ~ '^[A-Z]{2}$'),
  plays bigint not null default 0,
  primary key (day, country)
);

alter table public.listener_country_daily enable row level security;
revoke all on table public.listener_country_daily from public, anon, authenticated;
grant select on table public.listener_country_daily to service_role;

create or replace function public.record_listener_country(p_country text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.listener_country_daily (day, country, plays)
  values ((now() at time zone 'utc')::date, upper(p_country), 1)
  on conflict (day, country) do update set plays = public.listener_country_daily.plays + 1;
$$;

revoke all on function public.record_listener_country(text) from public, anon, authenticated;
grant execute on function public.record_listener_country(text) to service_role;
