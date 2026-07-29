-- BVS Rights Passport v1 + deterministic release preflight

alter table public.releases add column if not exists copyright_year integer;
alter table public.releases add column if not exists label_name text;
alter table public.releases add column if not exists master_owner_name text;
alter table public.releases add column if not exists composition_owner_names text[] not null default '{}';
alter table public.releases add column if not exists territories text[] not null default array['WORLD'];
alter table public.releases add column if not exists explicit_declared boolean not null default false;
alter table public.releases add column if not exists passport_version integer not null default 0;
alter table public.releases add column if not exists preflight_status text not null default 'not_checked'
  check (preflight_status in ('not_checked','needs_information','ready','legacy_approved'));
alter table public.releases add column if not exists preflight_blockers jsonb not null default '[]'::jsonb;
alter table public.releases add column if not exists preflight_checked_at timestamptz;

create table if not exists public.release_contributors (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.releases(id) on delete cascade,
  person_name text not null check (char_length(trim(person_name)) between 1 and 160),
  contribution_role text not null check (contribution_role in (
    'primary_artist','featured_artist','producer','songwriter','composer','engineer','other'
  )),
  share_percent numeric(5,2) check (share_percent is null or (share_percent >= 0 and share_percent <= 100)),
  rights_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (release_id, person_name, contribution_role)
);

create index if not exists release_contributors_release_idx
  on public.release_contributors(release_id, contribution_role);

alter table public.release_contributors enable row level security;
drop policy if exists "artists manage own release contributors" on public.release_contributors;
create policy "artists manage own release contributors" on public.release_contributors
  for all using (
    exists (select 1 from public.releases r where r.id=release_id and r.user_id=auth.uid())
  ) with check (
    exists (select 1 from public.releases r where r.id=release_id and r.user_id=auth.uid())
  );

update public.releases
set preflight_status='legacy_approved'
where editorial_status='approved' and passport_version=0 and preflight_status='not_checked';

create or replace function public.refresh_release_preflight(p_release_id uuid)
returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  r public.releases%rowtype;
  blockers jsonb := '[]'::jsonb;
  track_total integer;
begin
  select * into r from public.releases where id=p_release_id for update;
  if not found then raise exception 'RELEASE_NOT_FOUND'; end if;

  select count(*) into track_total from public.release_tracks where release_id=p_release_id;
  if trim(coalesce(r.title,''))='' then blockers := blockers || '"RELEASE_TITLE_REQUIRED"'::jsonb; end if;
  if trim(coalesce(r.genre,''))='' then blockers := blockers || '"GENRE_REQUIRED"'::jsonb; end if;
  if track_total < 1 then blockers := blockers || '"AUDIO_TRACK_REQUIRED"'::jsonb; end if;
  if r.cover_url is null or r.cover_url='' or r.cover_url like '%default-artwork%' then
    blockers := blockers || '"COVER_ART_REQUIRED"'::jsonb;
  end if;
  if not r.rights_confirmed then blockers := blockers || '"RIGHTS_ATTESTATION_REQUIRED"'::jsonb; end if;
  if not r.explicit_declared then blockers := blockers || '"EXPLICIT_STATUS_DECLARATION_REQUIRED"'::jsonb; end if;
  if r.copyright_year is null or r.copyright_year < 1900 or r.copyright_year > extract(year from now())::integer + 1 then
    blockers := blockers || '"VALID_COPYRIGHT_YEAR_REQUIRED"'::jsonb;
  end if;
  if trim(coalesce(r.master_owner_name,''))='' then blockers := blockers || '"MASTER_OWNER_REQUIRED"'::jsonb; end if;
  if cardinality(r.composition_owner_names)=0 then blockers := blockers || '"COMPOSITION_OWNER_REQUIRED"'::jsonb; end if;
  if cardinality(r.territories)=0 then blockers := blockers || '"TERRITORY_REQUIRED"'::jsonb; end if;
  if not exists (
    select 1 from public.release_contributors where release_id=p_release_id
      and contribution_role='primary_artist' and rights_confirmed
  ) then blockers := blockers || '"PRIMARY_ARTIST_CONFIRMATION_REQUIRED"'::jsonb; end if;
  if not exists (
    select 1 from public.release_contributors where release_id=p_release_id
      and contribution_role in ('songwriter','composer') and rights_confirmed
  ) then blockers := blockers || '"SONGWRITER_CONFIRMATION_REQUIRED"'::jsonb; end if;
  if not exists (
    select 1 from public.release_contributors where release_id=p_release_id
      and contribution_role='producer' and rights_confirmed
  ) then blockers := blockers || '"PRODUCER_CONFIRMATION_REQUIRED"'::jsonb; end if;
  if exists (
    select 1 from public.release_contributors where release_id=p_release_id and not rights_confirmed
  ) then blockers := blockers || '"CONTRIBUTOR_PERMISSION_REQUIRED"'::jsonb; end if;

  update public.releases set
    preflight_status=case when jsonb_array_length(blockers)=0 then 'ready' else 'needs_information' end,
    preflight_blockers=blockers,
    preflight_checked_at=now(),
    updated_at=now()
  where id=p_release_id;

  return jsonb_build_object(
    'status',case when jsonb_array_length(blockers)=0 then 'ready' else 'needs_information' end,
    'blockers',blockers
  );
end;
$$;

create or replace function public.assert_release_publishable(p_release_id uuid)
returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  r public.releases%rowtype;
  result jsonb;
begin
  select * into r from public.releases where id=p_release_id;
  if not found then raise exception 'RELEASE_NOT_FOUND'; end if;
  if r.passport_version=0 and r.preflight_status='legacy_approved' then
    return jsonb_build_object('status','legacy_approved','blockers','[]'::jsonb);
  end if;
  result := public.refresh_release_preflight(p_release_id);
  if result->>'status' <> 'ready' then raise exception 'RELEASE_PREFLIGHT_BLOCKED:%', result->'blockers'; end if;
  return result;
end;
$$;

revoke all on function public.refresh_release_preflight(uuid) from public,anon,authenticated;
revoke all on function public.assert_release_publishable(uuid) from public,anon,authenticated;
grant execute on function public.refresh_release_preflight(uuid) to service_role;
grant execute on function public.assert_release_publishable(uuid) to service_role;

