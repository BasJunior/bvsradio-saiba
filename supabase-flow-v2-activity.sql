-- BVS Flow v2 Pulse: real public content activity only. Safe to rerun.

create table if not exists public.bvs_activity_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in (
    'release_published', 'track_added_to_rotation', 'beat_published',
    'product_published', 'service_published', 'verified_credit_added',
    'story_published', 'show_scheduled', 'show_live', 'show_archive_published'
  )),
  subject_kind text not null check (subject_kind in (
    'track', 'release', 'creator', 'beat', 'story', 'show', 'product', 'service'
  )),
  subject_id text not null,
  creator_id uuid null references auth.users(id) on delete set null,
  title text not null,
  subtitle text null,
  route text not null,
  artwork text null,
  occurred_at timestamptz not null default now(),
  visible_at timestamptz not null default now(),
  visibility text not null default 'public' check (visibility in ('public', 'hidden')),
  source text not null,
  source_id text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists bvs_activity_source_unique
  on public.bvs_activity_events(source, source_id, kind)
  where source_id is not null;

create index if not exists bvs_activity_visible_idx
  on public.bvs_activity_events(visible_at desc)
  where visibility = 'public';

create index if not exists bvs_activity_creator_idx
  on public.bvs_activity_events(creator_id, visible_at desc);

alter table public.bvs_activity_events enable row level security;
revoke all on table public.bvs_activity_events from public, anon, authenticated;
grant select, insert, update on table public.bvs_activity_events to service_role;

-- Seed Pulse only from already-public, editorially trustworthy objects.
insert into public.bvs_activity_events (
  kind, subject_kind, subject_id, creator_id, title, subtitle, route, artwork,
  occurred_at, visible_at, source, source_id
)
select
  'track_added_to_rotation', 'track', t.id::text, t.user_id, t.title,
  t.artist_name, '/catalogue?q=' || t.title, t.artwork_url,
  coalesce(t.rotation_added_at, t.reviewed_at, t.created_at),
  coalesce(t.rotation_added_at, t.reviewed_at, t.created_at),
  'track', t.id::text
from public.tracks t
where t.is_public = true and t.editorial_status = 'approved' and t.in_rotation = true
on conflict do nothing;

insert into public.bvs_activity_events (
  kind, subject_kind, subject_id, creator_id, title, route, artwork,
  occurred_at, visible_at, source, source_id
)
select
  'beat_published', 'beat', b.id::text, b.producer_user_id, b.title,
  '/catalogue?type=beat&q=' || b.title || '#beatstore', b.artwork_path,
  coalesce(b.published_at, b.created_at), coalesce(b.published_at, b.created_at),
  'beat', b.id::text
from public.beats b
where b.is_public = true and b.status = 'published'
on conflict do nothing;

insert into public.bvs_activity_events (
  kind, subject_kind, subject_id, creator_id, title, subtitle, route, artwork,
  occurred_at, visible_at, source, source_id
)
select
  'release_published', 'release', r.id::text, r.user_id, r.title,
  r.artist_name, '/album/' || r.id::text, r.cover_url,
  coalesce(r.published_at, r.created_at), coalesce(r.published_at, r.created_at),
  'release', r.id::text
from public.releases r
where r.is_public = true and r.editorial_status = 'approved'
on conflict do nothing;

insert into public.bvs_activity_events (
  kind, subject_kind, subject_id, creator_id, title, route,
  occurred_at, visible_at, source, source_id
)
select
  'story_published', 'story', a.id::text, a.author_id, a.title,
  '/articles/' || a.slug,
  coalesce(a.published_at, a.updated_at, a.created_at),
  coalesce(a.published_at, a.updated_at, a.created_at),
  'editorial_article', a.id::text
from public.editorial_articles a
where a.status = 'published' and a.slug is not null
on conflict do nothing;

insert into public.bvs_activity_events (
  kind, subject_kind, subject_id, creator_id, title, subtitle, route, artwork,
  occurred_at, visible_at, source, source_id
)
select
  case when l.listing_type = 'service' then 'service_published' else 'product_published' end,
  case when l.listing_type = 'service' then 'service' else 'product' end,
  l.id::text, l.seller_user_id, l.title, l.category,
  '/marketplace?listing=' || l.slug, l.artwork_path,
  coalesce(l.published_at, l.created_at), coalesce(l.published_at, l.created_at),
  'marketplace_listing', l.id::text
from public.creator_marketplace_listings l
where l.status = 'published' and l.listing_type in ('service', 'digital_product')
on conflict do nothing;

create or replace function public.upsert_bvs_activity_event(
  p_kind text,
  p_subject_kind text,
  p_subject_id text,
  p_creator_id uuid,
  p_title text,
  p_subtitle text,
  p_route text,
  p_artwork text,
  p_occurred_at timestamptz,
  p_source text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.bvs_activity_events (
    kind, subject_kind, subject_id, creator_id, title, subtitle, route, artwork,
    occurred_at, visible_at, visibility, source, source_id
  ) values (
    p_kind, p_subject_kind, p_subject_id, p_creator_id, p_title, p_subtitle,
    p_route, p_artwork, coalesce(p_occurred_at, now()), now(), 'public',
    p_source, p_subject_id
  )
  on conflict (source, source_id, kind) where source_id is not null
  do update set
    creator_id = excluded.creator_id,
    title = excluded.title,
    subtitle = excluded.subtitle,
    route = excluded.route,
    artwork = excluded.artwork,
    visible_at = case
      when public.bvs_activity_events.visibility = 'hidden' then now()
      else public.bvs_activity_events.visible_at
    end,
    visibility = 'public';
$$;

revoke execute on function public.upsert_bvs_activity_event(text, text, text, uuid, text, text, text, text, timestamptz, text)
  from public, anon, authenticated;

create or replace function public.sync_track_pulse_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_public = true and new.editorial_status = 'approved' and new.in_rotation = true then
    perform public.upsert_bvs_activity_event(
      'track_added_to_rotation', 'track', new.id::text, new.user_id, new.title,
      new.artist_name, '/catalogue?q=' || new.title, new.artwork_url,
      coalesce(new.rotation_added_at, new.reviewed_at, new.created_at), 'track'
    );
  else
    update public.bvs_activity_events set visibility = 'hidden'
      where source = 'track' and source_id = new.id::text and kind = 'track_added_to_rotation';
  end if;
  return new;
end;
$$;

drop trigger if exists tracks_sync_pulse on public.tracks;
create trigger tracks_sync_pulse
after insert or update of is_public, editorial_status, in_rotation, title, artist_name, artwork_url
on public.tracks for each row execute function public.sync_track_pulse_event();

create or replace function public.sync_beat_pulse_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_public = true and new.status = 'published' then
    perform public.upsert_bvs_activity_event(
      'beat_published', 'beat', new.id::text, new.producer_user_id, new.title,
      null, '/catalogue?type=beat&q=' || new.title || '#beatstore', new.artwork_path,
      coalesce(new.published_at, new.created_at), 'beat'
    );
  else
    update public.bvs_activity_events set visibility = 'hidden'
      where source = 'beat' and source_id = new.id::text and kind = 'beat_published';
  end if;
  return new;
end;
$$;

drop trigger if exists beats_sync_pulse on public.beats;
create trigger beats_sync_pulse
after insert or update of is_public, status, title, artwork_path
on public.beats for each row execute function public.sync_beat_pulse_event();

create or replace function public.sync_release_pulse_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_public = true and new.editorial_status = 'approved' then
    perform public.upsert_bvs_activity_event(
      'release_published', 'release', new.id::text, new.user_id, new.title,
      new.artist_name, '/album/' || new.id::text, new.cover_url,
      coalesce(new.published_at, new.created_at), 'release'
    );
  else
    update public.bvs_activity_events set visibility = 'hidden'
      where source = 'release' and source_id = new.id::text and kind = 'release_published';
  end if;
  return new;
end;
$$;

drop trigger if exists releases_sync_pulse on public.releases;
create trigger releases_sync_pulse
after insert or update of is_public, editorial_status, title, artist_name, cover_url
on public.releases for each row execute function public.sync_release_pulse_event();

create or replace function public.sync_story_pulse_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'published' and new.slug is not null then
    perform public.upsert_bvs_activity_event(
      'story_published', 'story', new.id::text, new.author_id, new.title,
      null, '/articles/' || new.slug, null,
      coalesce(new.published_at, new.updated_at, new.created_at), 'editorial_article'
    );
  else
    update public.bvs_activity_events set visibility = 'hidden'
      where source = 'editorial_article' and source_id = new.id::text and kind = 'story_published';
  end if;
  return new;
end;
$$;

drop trigger if exists editorial_articles_sync_pulse on public.editorial_articles;
create trigger editorial_articles_sync_pulse
after insert or update of status, slug, title
on public.editorial_articles for each row execute function public.sync_story_pulse_event();

create or replace function public.sync_marketplace_pulse_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  activity_kind text;
  object_kind text;
begin
  activity_kind := case when new.listing_type = 'service' then 'service_published' else 'product_published' end;
  object_kind := case when new.listing_type = 'service' then 'service' else 'product' end;
  if new.status = 'published' and new.listing_type in ('service', 'digital_product') then
    perform public.upsert_bvs_activity_event(
      activity_kind, object_kind, new.id::text, new.seller_user_id, new.title,
      new.category, '/marketplace?listing=' || new.slug, new.artwork_path,
      coalesce(new.published_at, new.created_at), 'marketplace_listing'
    );
  else
    update public.bvs_activity_events set visibility = 'hidden'
      where source = 'marketplace_listing' and source_id = new.id::text;
  end if;
  return new;
end;
$$;

drop trigger if exists marketplace_listings_sync_pulse on public.creator_marketplace_listings;
create trigger marketplace_listings_sync_pulse
after insert or update of status, listing_type, title, category, slug, artwork_path
on public.creator_marketplace_listings for each row execute function public.sync_marketplace_pulse_event();

revoke execute on function public.sync_track_pulse_event() from public, anon, authenticated;
revoke execute on function public.sync_beat_pulse_event() from public, anon, authenticated;
revoke execute on function public.sync_release_pulse_event() from public, anon, authenticated;
revoke execute on function public.sync_story_pulse_event() from public, anon, authenticated;
revoke execute on function public.sync_marketplace_pulse_event() from public, anon, authenticated;
