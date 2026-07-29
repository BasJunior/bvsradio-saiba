-- BVS media preflight queue and publication gate

create table if not exists public.media_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.releases(id) on delete cascade,
  release_track_id uuid not null unique references public.release_tracks(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  source_path text not null,
  status text not null default 'queued'
    check (status in ('queued','processing','ready','blocked','failed')),
  attempts integer not null default 0,
  checksum_sha256 text,
  source_bytes bigint,
  format_name text,
  codec_name text,
  duration_seconds numeric(12,3),
  sample_rate integer,
  channels integer,
  bitrate integer,
  loudness_lufs numeric(8,3),
  true_peak_db numeric(8,3),
  duplicate_of_job_id uuid references public.media_processing_jobs(id) on delete set null,
  waveform_path text,
  preview_path text,
  malware_status text not null default 'pending'
    check (malware_status in ('pending','clean','infected','not_available','error')),
  blockers jsonb not null default '[]'::jsonb,
  error_code text,
  error_detail text,
  claimed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists media_processing_jobs_queue_idx
  on public.media_processing_jobs(status, created_at);
create index if not exists media_processing_jobs_checksum_idx
  on public.media_processing_jobs(checksum_sha256) where status='ready';
create index if not exists media_processing_jobs_release_idx
  on public.media_processing_jobs(release_id, status);

alter table public.media_processing_jobs enable row level security;
drop policy if exists "artists read own media processing" on public.media_processing_jobs;
create policy "artists read own media processing" on public.media_processing_jobs
  for select using (owner_user_id=auth.uid());

create or replace function public.assert_release_media_ready(p_release_id uuid)
returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  expected_count integer;
  ready_count integer;
  failed_count integer;
begin
  select count(*) into expected_count from public.release_tracks where release_id=p_release_id;
  select count(*) into ready_count from public.media_processing_jobs
    where release_id=p_release_id and status='ready';
  select count(*) into failed_count from public.media_processing_jobs
    where release_id=p_release_id and status in ('blocked','failed');
  if expected_count=0 then raise exception 'MEDIA_PREFLIGHT_BLOCKED:NO_TRACKS'; end if;
  if failed_count>0 then raise exception 'MEDIA_PREFLIGHT_BLOCKED:FAILED_OR_BLOCKED'; end if;
  if ready_count<>expected_count then raise exception 'MEDIA_PREFLIGHT_BLOCKED:PROCESSING_INCOMPLETE'; end if;
  return jsonb_build_object('status','ready','tracks',ready_count);
end;
$$;

revoke all on function public.assert_release_media_ready(uuid) from public,anon,authenticated;
grant execute on function public.assert_release_media_ready(uuid) to service_role;

