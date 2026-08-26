-- BVS Staff Copilot Phase 1 — beta only.
-- Service-only storage for staff threads, messages and audit/rate-limit events.
-- No client RLS policies are created. The Vercel route uses the service role after editorialIdentity().

create table if not exists public.staff_copilot_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Ops thread' check (char_length(title) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_copilot_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.staff_copilot_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','tool','system')),
  content text not null check (char_length(content) between 1 and 12000),
  tool_trace jsonb,
  citations jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.staff_copilot_audit (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid references public.staff_copilot_threads(id) on delete set null,
  action text not null check (char_length(action) between 1 and 80),
  tool text,
  status text not null check (status in ('ok','denied','error','unavailable')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists staff_copilot_threads_user_idx
  on public.staff_copilot_threads(user_id, updated_at desc);
create index if not exists staff_copilot_messages_thread_idx
  on public.staff_copilot_messages(thread_id, created_at asc);
create index if not exists staff_copilot_audit_user_window_idx
  on public.staff_copilot_audit(user_id, action, created_at desc);
create index if not exists staff_copilot_audit_created_idx
  on public.staff_copilot_audit(created_at desc);

alter table public.staff_copilot_threads enable row level security;
alter table public.staff_copilot_messages enable row level security;
alter table public.staff_copilot_audit enable row level security;

revoke all on public.staff_copilot_threads from anon, authenticated;
revoke all on public.staff_copilot_messages from anon, authenticated;
revoke all on public.staff_copilot_audit from anon, authenticated;
grant all on public.staff_copilot_threads to service_role;
grant all on public.staff_copilot_messages to service_role;
grant all on public.staff_copilot_audit to service_role;

revoke all on sequence public.staff_copilot_audit_id_seq from anon, authenticated;
grant usage, select on sequence public.staff_copilot_audit_id_seq to service_role;

comment on table public.staff_copilot_threads is 'SERVICE ONLY — BVS Staff Copilot beta threads.';
comment on table public.staff_copilot_messages is 'SERVICE ONLY — BVS Staff Copilot beta transcript and grounded tool metadata.';
comment on table public.staff_copilot_audit is 'SERVICE ONLY — BVS Staff Copilot beta audit and per-user request-rate events.';

notify pgrst, 'reload schema';
