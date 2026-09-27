-- Durable server-side state for creator uploads.
-- The browser may disappear at any point; this record exists before large media moves.

create table if not exists public.creator_upload_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  submission_type text not null default 'track'
    check (submission_type in ('track', 'release')),
  state text not null default 'preparing'
    check (state in ('preparing', 'uploading', 'uploaded', 'finalizing', 'submitted', 'failed', 'abandoned')),
  payload jsonb not null default '{}'::jsonb,
  media_manifest jsonb not null default '{}'::jsonb,
  result_type text null
    check (result_type is null or result_type in ('track', 'release')),
  result_id uuid null,
  last_error text null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  submitted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creator_upload_sessions_user_state_created_idx
  on public.creator_upload_sessions (user_id, state, created_at desc);

create index if not exists creator_upload_sessions_expires_idx
  on public.creator_upload_sessions (expires_at)
  where state not in ('submitted', 'abandoned');

alter table public.creator_upload_sessions enable row level security;

-- This is a server-only control-plane table. Browser roles do not receive table
-- privileges; server routes use the service role after independently authenticating
-- the creator and always scope reads/writes by user_id.
revoke all on table public.creator_upload_sessions from public;
revoke all on table public.creator_upload_sessions from anon;
revoke all on table public.creator_upload_sessions from authenticated;
grant select, insert, update, delete on table public.creator_upload_sessions to service_role;

drop trigger if exists creator_upload_sessions_set_updated_at on public.creator_upload_sessions;
create trigger creator_upload_sessions_set_updated_at
before update on public.creator_upload_sessions
for each row execute function public.set_updated_at();

comment on table public.creator_upload_sessions is
  'Server-only durable state for creator media uploads before editorial track/release records exist.';
