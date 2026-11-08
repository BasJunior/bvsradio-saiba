-- Marketplace providers can manage their public service area in Studio.
-- Existing seed location remains authoritative until Editorial approves edits.
alter table public.creator_marketplace_profiles
  add column if not exists location text not null default '';

comment on column public.creator_marketplace_profiles.location is
  'Public approximate service area for the provider. Never use a private street address.';

-- Seeded Up-Town Music's requested area, without overwriting a later owner edit.
update public.creator_marketplace_profiles m
set location = 'Borrowdale, Harare'
from public.profiles p
where m.user_id = p.id
  and lower(p.username) = 'uptownmusic'
  and m.location = '';
