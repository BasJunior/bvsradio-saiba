-- Claim the existing WolfBridges Studio marketplace under Wolf Bridges' real BVS account.
-- Idempotent: resolves stable usernames/slug instead of generated UUIDs and preserves listing/file identity.

do $$
declare
  v_wolf_user_id uuid;
  v_founder_user_id uuid;
begin
  select id into v_wolf_user_id
  from public.profiles
  where lower(username) = 'wolf-bridges'
  limit 1;

  select id into v_founder_user_id
  from public.profiles
  where lower(username) = 'basjunior'
  limit 1;

  if v_wolf_user_id is null then
    raise exception 'Wolf Bridges profile not found';
  end if;

  if v_founder_user_id is null then
    raise exception 'Founder profile not found';
  end if;

  insert into public.creator_marketplace_profiles (
    user_id,
    roles,
    headline,
    bio,
    skills,
    status,
    updated_at
  ) values (
    v_wolf_user_id,
    array['artist','producer','engineer','studio']::text[],
    'Recording, mixing, mastering and beat-based production in Harare.',
    'WolfBridges Studio offers music production services for artists who need recording, mixing, mastering and beat-based production support in one place.',
    array['Recording','Mixing','Mastering','Music production','Beat leases']::text[],
    'approved',
    now()
  )
  on conflict (user_id) do nothing;

  update public.creator_marketplace_listings
  set seller_user_id = v_wolf_user_id,
      updated_at = now()
  where slug = 'wolf-bridges-fl-studio-mixer-preset-bundle-vol-1'
    and seller_user_id = v_founder_user_id;

  update public.marketplace_provider_slots
  set owner_user_id = v_wolf_user_id,
      updated_at = now()
  where provider_key = 'wolfbridges-studio'
    and owner_user_id = v_founder_user_id;
end
$$;
