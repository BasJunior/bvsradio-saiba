-- On-platform buyer-to-seller enquiries for the Creator Marketplace.
-- Threads and messages are kept so staff can review them for disputes and refunds.
-- Safe to rerun. Requires public.is_artist_wallet_admin().

create table if not exists public.marketplace_enquiries (
  id uuid primary key default gen_random_uuid(),
  buyer_user_id uuid not null references public.profiles(id) on delete restrict,
  seller_user_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  unique (buyer_user_id, seller_user_id),
  check (buyer_user_id <> seller_user_id)
);

create table if not exists public.marketplace_enquiry_messages (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.marketplace_enquiries(id) on delete restrict,
  author_user_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists marketplace_enquiries_buyer_idx
  on public.marketplace_enquiries (buyer_user_id, last_message_at desc);
create index if not exists marketplace_enquiries_seller_idx
  on public.marketplace_enquiries (seller_user_id, last_message_at desc);
create index if not exists marketplace_enquiry_messages_thread_idx
  on public.marketplace_enquiry_messages (enquiry_id, created_at asc);

create or replace function public.touch_marketplace_enquiry()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.marketplace_enquiries
  set last_message_at = new.created_at
  where id = new.enquiry_id;
  return new;
end;
$$;

drop trigger if exists marketplace_enquiry_message_touch on public.marketplace_enquiry_messages;
create trigger marketplace_enquiry_message_touch
  after insert on public.marketplace_enquiry_messages
  for each row execute function public.touch_marketplace_enquiry();

alter table public.marketplace_enquiries enable row level security;
alter table public.marketplace_enquiry_messages enable row level security;

drop policy if exists "Enquiry participants read threads" on public.marketplace_enquiries;
create policy "Enquiry participants read threads" on public.marketplace_enquiries for select
  using (buyer_user_id = auth.uid() or seller_user_id = auth.uid() or public.is_artist_wallet_admin());

drop policy if exists "Enquiry participants read messages" on public.marketplace_enquiry_messages;
create policy "Enquiry participants read messages" on public.marketplace_enquiry_messages for select
  using (
    exists (
      select 1 from public.marketplace_enquiries e
      where e.id = enquiry_id and (e.buyer_user_id = auth.uid() or e.seller_user_id = auth.uid())
    )
    or public.is_artist_wallet_admin()
  );

-- All writes go through the API. Messages are append-only, even for the service role.
revoke all on table public.marketplace_enquiries, public.marketplace_enquiry_messages from public, anon, authenticated;
grant select on table public.marketplace_enquiries, public.marketplace_enquiry_messages to authenticated;
revoke all on table public.marketplace_enquiries, public.marketplace_enquiry_messages from service_role;
grant select, insert, update on table public.marketplace_enquiries to service_role;
grant select, insert on table public.marketplace_enquiry_messages to service_role;

revoke all on function public.touch_marketplace_enquiry() from public, anon, authenticated;

comment on table public.marketplace_enquiries is
  'One permanent conversation per buyer and seller, kept for dispute and refund review.';
comment on table public.marketplace_enquiry_messages is
  'Append-only messages in a Marketplace enquiry.';
