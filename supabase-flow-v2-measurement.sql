-- BVS Flow v2 measurement foundation. Safe to rerun.
-- Qualified means 30 seconds genuinely listened; it does not mean payable.

create table if not exists public.stream_qualifications (
  id uuid primary key default gen_random_uuid(),
  play_instance_id uuid not null unique,
  track_id uuid not null references public.tracks(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete set null,
  source text not null check (source in ('station', 'ondemand')),
  listened_seconds integer not null check (listened_seconds >= 30 and listened_seconds <= 300),
  status text not null default 'pending'
    check (status in ('pending', 'eligible', 'rejected', 'settled')),
  rejection_reason text null,
  qualified_at timestamptz not null default now(),
  settled_at timestamptz null,
  payout_batch_id uuid null,
  created_at timestamptz not null default now()
);

create index if not exists stream_qualifications_track_idx
  on public.stream_qualifications(track_id, qualified_at desc);

create index if not exists stream_qualifications_status_idx
  on public.stream_qualifications(status, qualified_at);

alter table public.stream_qualifications enable row level security;

revoke all on table public.stream_qualifications from public, anon, authenticated;
grant select, insert, update on table public.stream_qualifications to service_role;
