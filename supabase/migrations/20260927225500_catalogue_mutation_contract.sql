-- Catalogue mutation belongs to BVS authenticated server routes.
-- Browser roles retain only public/own reads required by creator and listener UX.

revoke insert, update, delete on table public.tracks from anon, authenticated;
revoke insert, update, delete on table public.releases from anon, authenticated;
revoke insert, update, delete on table public.release_tracks from anon, authenticated;
revoke insert, update, delete on table public.beats from anon, authenticated;

grant select on table public.tracks to anon, authenticated;
grant select on table public.releases to anon, authenticated;
grant select on table public.release_tracks to anon, authenticated;
grant select on table public.beats to anon, authenticated;

grant select, insert, update, delete on table public.tracks to service_role;
grant select, insert, update, delete on table public.releases to service_role;
grant select, insert, update, delete on table public.release_tracks to service_role;
grant select, insert, update, delete on table public.beats to service_role;

drop policy if exists "Users can insert own tracks" on public.tracks;
drop policy if exists "Users can update own tracks" on public.tracks;
drop policy if exists "Users can delete own tracks" on public.tracks;

drop policy if exists "artists manage own releases" on public.releases;
create policy "artists can read own releases"
on public.releases
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "artists manage own release_tracks via release" on public.release_tracks;
create policy "artists can read own release_tracks via release"
on public.release_tracks
for select
to authenticated
using (
  exists (
    select 1
    from public.releases r
    where r.id = release_tracks.release_id
      and r.user_id = (select auth.uid())
  )
);

drop policy if exists "beats producer all" on public.beats;
create policy "producers can read own beats"
on public.beats
for select
to authenticated
using (producer_user_id = (select auth.uid()));

comment on table public.tracks is
  'Browser-readable under RLS; mutation is server-mediated so editorial/publication fields cannot be self-approved.';
comment on table public.releases is
  'Browser-readable under RLS; creator mutation/finalization is server-mediated.';
comment on table public.beats is
  'Browser-readable under RLS; producer mutation/publication is server-mediated.';
