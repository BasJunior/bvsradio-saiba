-- BVS profile privacy / privilege boundary.
-- Browser roles may read only public identity columns. All profile mutation is
-- mediated by authenticated BVS API routes using service_role.

revoke all on table public.profiles from anon, authenticated;

grant select (
  id,
  username,
  display_name,
  avatar_url,
  bio,
  website_url,
  location,
  role,
  is_verified,
  follower_count,
  following_count,
  created_at,
  updated_at,
  is_published,
  is_producer,
  creator_public_name,
  creator_name_status,
  spotify_artist_id,
  spotify_url
) on table public.profiles to anon, authenticated;

grant select, insert, update, delete on table public.profiles to service_role;

drop policy if exists "Profiles are viewable by everyone" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Published profiles and own profile are readable"
on public.profiles
for select
to anon, authenticated
using (
  is_published = true
  or (select auth.uid()) = id
);

comment on table public.profiles is
  'Public creator identity is column-limited for browser roles. Account/entitlement/rights fields and all mutation are server-mediated.';
