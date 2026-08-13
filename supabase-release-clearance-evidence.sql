-- BVS Release Clearance Evidence v1
-- Extends Rights Passport without changing legacy-approved releases.

alter table public.releases add column if not exists material_types text[] not null default array['original'];
alter table public.releases add column if not exists clearance_declaration_version integer not null default 1;

create table if not exists public.release_clearance_evidence (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.releases(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  material_type text not null check (material_type in ('cover','remix','sample','leased_beat','other_third_party')),
  evidence_version integer not null default 1 check (evidence_version > 0),
  file_path text not null check (char_length(trim(file_path)) between 1 and 1000),
  original_file_name text not null check (char_length(trim(original_file_name)) between 1 and 255),
  mime_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 10485760),
  artist_notes text,
  review_status text not null default 'submitted'
    check (review_status in ('submitted','approved','rejected','superseded')),
  review_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (release_id, material_type, evidence_version)
);

create index if not exists release_clearance_evidence_release_idx
  on public.release_clearance_evidence(release_id, material_type, review_status);

alter table public.release_clearance_evidence enable row level security;
drop policy if exists "artists read own clearance evidence" on public.release_clearance_evidence;
create policy "artists read own clearance evidence" on public.release_clearance_evidence
  for select using (owner_user_id=auth.uid());
drop policy if exists "artists submit own clearance evidence" on public.release_clearance_evidence;
create policy "artists submit own clearance evidence" on public.release_clearance_evidence
  for insert with check (
    owner_user_id=auth.uid() and exists (
      select 1 from public.releases r where r.id=release_id and r.user_id=auth.uid()
    )
  );

create or replace function public.refresh_release_preflight(p_release_id uuid)
returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  r public.releases%rowtype;
  blockers jsonb := '[]'::jsonb;
  track_total integer;
  material text;
begin
  select * into r from public.releases where id=p_release_id for update;
  if not found then raise exception 'RELEASE_NOT_FOUND'; end if;

  select count(*) into track_total from public.release_tracks where release_id=p_release_id;
  if trim(coalesce(r.title,''))='' then blockers := blockers || '"RELEASE_TITLE_REQUIRED"'::jsonb; end if;
  if trim(coalesce(r.genre,''))='' then blockers := blockers || '"GENRE_REQUIRED"'::jsonb; end if;
  if track_total < 1 then blockers := blockers || '"AUDIO_TRACK_REQUIRED"'::jsonb; end if;
  if r.cover_url is null or r.cover_url='' or r.cover_url like '%default-artwork%' then blockers := blockers || '"COVER_ART_REQUIRED"'::jsonb; end if;
  if not r.rights_confirmed then blockers := blockers || '"RIGHTS_ATTESTATION_REQUIRED"'::jsonb; end if;
  if not r.explicit_declared then blockers := blockers || '"EXPLICIT_STATUS_DECLARATION_REQUIRED"'::jsonb; end if;
  if r.copyright_year is null or r.copyright_year < 1900 or r.copyright_year > extract(year from now())::integer + 1 then blockers := blockers || '"VALID_COPYRIGHT_YEAR_REQUIRED"'::jsonb; end if;
  if trim(coalesce(r.master_owner_name,''))='' then blockers := blockers || '"MASTER_OWNER_REQUIRED"'::jsonb; end if;
  if cardinality(r.composition_owner_names)=0 then blockers := blockers || '"COMPOSITION_OWNER_REQUIRED"'::jsonb; end if;
  if cardinality(r.territories)=0 then blockers := blockers || '"TERRITORY_REQUIRED"'::jsonb; end if;
  if not exists (select 1 from public.release_contributors where release_id=p_release_id and contribution_role='primary_artist' and rights_confirmed) then blockers := blockers || '"PRIMARY_ARTIST_CONFIRMATION_REQUIRED"'::jsonb; end if;
  if not exists (select 1 from public.release_contributors where release_id=p_release_id and contribution_role in ('songwriter','composer') and rights_confirmed) then blockers := blockers || '"SONGWRITER_CONFIRMATION_REQUIRED"'::jsonb; end if;
  if not exists (select 1 from public.release_contributors where release_id=p_release_id and contribution_role='producer' and rights_confirmed) then blockers := blockers || '"PRODUCER_CONFIRMATION_REQUIRED"'::jsonb; end if;
  if exists (select 1 from public.release_contributors where release_id=p_release_id and not rights_confirmed) then blockers := blockers || '"CONTRIBUTOR_PERMISSION_REQUIRED"'::jsonb; end if;

  if cardinality(r.material_types)=0 then
    blockers := blockers || '"MATERIAL_TYPE_DECLARATION_REQUIRED"'::jsonb;
  end if;
  foreach material in array coalesce(r.material_types, array[]::text[]) loop
    if material <> 'original' and not exists (
      select 1 from public.release_clearance_evidence e
      where e.release_id=p_release_id and e.material_type=material and e.review_status='approved'
    ) then
      blockers := blockers || to_jsonb(upper(material) || '_CLEARANCE_EVIDENCE_REQUIRED');
    end if;
  end loop;

  update public.releases set
    preflight_status=case when jsonb_array_length(blockers)=0 then 'ready' else 'needs_information' end,
    preflight_blockers=blockers,
    preflight_checked_at=now(), updated_at=now()
  where id=p_release_id;
  return jsonb_build_object('status',case when jsonb_array_length(blockers)=0 then 'ready' else 'needs_information' end,'blockers',blockers);
end;
$$;

revoke all on function public.refresh_release_preflight(uuid) from public,anon,authenticated;
grant execute on function public.refresh_release_preflight(uuid) to service_role;
