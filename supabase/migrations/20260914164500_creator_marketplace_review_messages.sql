create table if not exists public.creator_marketplace_review_messages (
  id uuid primary key default gen_random_uuid(),
  seller_user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('profile', 'listing')),
  entity_id uuid not null,
  author_user_id uuid references auth.users(id) on delete set null,
  author_kind text not null check (author_kind in ('editor', 'creator')),
  message text not null check (char_length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists creator_marketplace_review_messages_seller_created_idx
  on public.creator_marketplace_review_messages (seller_user_id, created_at desc);

create index if not exists creator_marketplace_review_messages_entity_created_idx
  on public.creator_marketplace_review_messages (entity_type, entity_id, created_at asc);

alter table public.creator_marketplace_review_messages enable row level security;

drop policy if exists "Marketplace sellers read own review messages" on public.creator_marketplace_review_messages;
create policy "Marketplace sellers read own review messages" on public.creator_marketplace_review_messages
  for select using (auth.uid() = seller_user_id);

comment on table public.creator_marketplace_review_messages is
  'Persistent Editorial and creator conversation attached to a Creator Marketplace profile or listing.';
