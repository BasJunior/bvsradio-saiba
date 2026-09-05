-- BVS beta: private Song Workspace / Lyrics Pad
-- Creation and mutation are service-role only. Licensed-beat pads require a paid/fulfilled
-- beat order; free blank pads use an internal non-payment workspace record.

create table if not exists public.song_workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete restrict,
  order_reference text not null,
  beat_id uuid not null references public.beats(id) on delete restrict,
  licence_option_id uuid references public.beat_licence_options(id) on delete set null,
  beat_title_snapshot text not null,
  producer_name_snapshot text,
  licence_code_snapshot text,
  licence_summary_snapshot text,
  licence_terms_version_snapshot text,
  song_title text not null default '',
  lyrics text not null default '',
  notes text not null default '',
  status text not null default 'draft' check (status in ('draft','ready_to_release','released')),
  release_id uuid references public.releases(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, order_id, beat_id)
);

create index if not exists song_workspaces_user_updated_idx on public.song_workspaces(user_id, updated_at desc);
create index if not exists song_workspaces_order_idx on public.song_workspaces(order_id);
create index if not exists song_workspaces_beat_idx on public.song_workspaces(beat_id);

alter table public.song_workspaces enable row level security;

drop policy if exists "song workspaces select own" on public.song_workspaces;
create policy "song workspaces select own" on public.song_workspaces for select using (auth.uid() = user_id);

-- Do not permit direct browser inserts/updates/deletes. The BVS API uses the service role
-- after checking the signed-in account and workspace entitlement. This keeps release_id,
-- status and licence snapshots server-controlled while lyrics still autosave through the API.
drop policy if exists "song workspaces update own" on public.song_workspaces;

create or replace function public.verify_bvs_song_workspace_clearance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  workspace_id uuid;
begin
  if new.material_type <> 'leased_beat' or coalesce(new.artist_notes, '') not like 'BVS_SONG_WORKSPACE:%' then
    return new;
  end if;

  begin
    workspace_id := split_part(new.artist_notes, ':', 2)::uuid;
  exception when others then
    return new;
  end;

  -- Free blank pads deliberately use order status free_workspace, so they cannot satisfy
  -- this paid-licence release-clearance bridge.
  if exists (
    select 1
    from public.song_workspaces sw
    join public.orders o on o.id = sw.order_id
    join public.releases r on r.id = new.release_id
    where sw.id = workspace_id
      and sw.user_id = new.owner_user_id
      and r.user_id = sw.user_id
      and o.customer_user_id = sw.user_id
      and o.status in ('paid', 'fulfilled')
      and sw.beat_id is not null
  ) then
    new.review_status := 'approved';
    new.review_notes := 'Automatically verified from the buyer''s paid BVS beat licence and Song Workspace entitlement.';
    new.reviewed_at := now();

    update public.song_workspaces
      set release_id = new.release_id,
          status = 'ready_to_release',
          updated_at = now()
      where id = workspace_id and user_id = new.owner_user_id;
  end if;

  return new;
end;
$$;

-- This function exists only for the database trigger. Do not expose the SECURITY DEFINER
-- function as a callable RPC to browser roles.
revoke execute on function public.verify_bvs_song_workspace_clearance() from public, anon, authenticated;
grant execute on function public.verify_bvs_song_workspace_clearance() to service_role;

drop trigger if exists verify_bvs_song_workspace_clearance on public.release_clearance_evidence;
create trigger verify_bvs_song_workspace_clearance
before insert on public.release_clearance_evidence
for each row execute function public.verify_bvs_song_workspace_clearance();
