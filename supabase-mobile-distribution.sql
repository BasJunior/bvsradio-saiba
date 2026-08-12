-- Surface-specific mobile catalogue clearance for App Store / Play Store builds.
-- A missing row is deliberately treated as not cleared.

create table if not exists public.mobile_distribution_clearances (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.tracks(id) on delete cascade,
  surface text not null check (surface in ('ios','android')),
  status text not null default 'not_reviewed' check (status in ('not_reviewed','cleared','blocked')),
  rights_basis text not null default '' check (char_length(rights_basis) <= 120),
  evidence_reference text not null default '' check (char_length(evidence_reference) <= 500),
  review_notes text not null default '' check (char_length(review_notes) <= 2000),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(track_id, surface),
  check (status <> 'cleared' or (char_length(trim(rights_basis)) > 0 and char_length(trim(evidence_reference)) > 0))
);

create index if not exists mobile_distribution_surface_status_idx
  on public.mobile_distribution_clearances(surface, status, updated_at desc);
create index if not exists mobile_distribution_track_idx
  on public.mobile_distribution_clearances(track_id, surface);

alter table public.mobile_distribution_clearances enable row level security;
revoke all on public.mobile_distribution_clearances from anon, authenticated;
grant all on public.mobile_distribution_clearances to service_role;

comment on table public.mobile_distribution_clearances is
  'Editorial evidence gate for surface-specific mobile catalogues. Missing rows are never distributed.';
