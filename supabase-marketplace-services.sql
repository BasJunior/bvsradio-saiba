-- BVS Creator Marketplace professional profiles + service fulfilment
-- Safe to rerun after creator marketplace and marketplace economics packs.

alter table public.creator_marketplace_profiles add column if not exists experience text not null default '';
alter table public.creator_marketplace_profiles add column if not exists credits jsonb not null default '[]'::jsonb;
alter table public.creator_marketplace_profiles add column if not exists equipment text[] not null default '{}'::text[];
alter table public.creator_marketplace_profiles add column if not exists software text[] not null default '{}'::text[];

alter table public.creator_marketplace_listings add column if not exists packages jsonb not null default '[]'::jsonb;
alter table public.creator_marketplace_listings add column if not exists addons jsonb not null default '[]'::jsonb;
alter table public.creator_marketplace_listings add column if not exists turnaround_days integer check (turnaround_days between 1 and 120);
alter table public.creator_marketplace_listings add column if not exists revisions_included integer not null default 0 check (revisions_included between 0 and 20);

alter table public.commerce_seller_settlements drop constraint if exists commerce_seller_settlements_settlement_status_check;
alter table public.commerce_seller_settlements add constraint commerce_seller_settlements_settlement_status_check
  check (settlement_status in ('pending_processor','held_service','posted','reversed'));

create table if not exists public.creator_service_orders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  order_reference text not null unique,
  listing_id uuid not null references public.creator_marketplace_listings(id) on delete restrict,
  buyer_user_id uuid not null references public.profiles(id) on delete restrict,
  seller_user_id uuid not null references public.profiles(id) on delete restrict,
  title_snapshot text not null,
  package_snapshot jsonb not null default '{}'::jsonb,
  brief text not null,
  amount_usd numeric(12,2) not null check (amount_usd > 0),
  revisions_included integer not null default 0,
  revisions_used integer not null default 0,
  status text not null default 'paid_waiting_seller' check (status in ('paid_waiting_seller','accepted','in_progress','delivered','revision_requested','completed','cancel_requested','disputed','cancelled','refunded')),
  seller_due_at timestamptz,
  delivered_at timestamptz,
  completed_at timestamptz,
  disputed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_service_order_events (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references public.creator_service_orders(id) on delete cascade,
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  event_type text not null check (event_type in ('message','accepted','started','delivery','revision_requested','completed','cancel_requested','dispute','staff_note')),
  message text not null default '',
  file_path text,
  created_at timestamptz not null default now()
);

create index if not exists creator_service_orders_buyer_idx on public.creator_service_orders(buyer_user_id, created_at desc);
create index if not exists creator_service_orders_seller_idx on public.creator_service_orders(seller_user_id, created_at desc);
create index if not exists creator_service_order_events_order_idx on public.creator_service_order_events(service_order_id, created_at asc);

alter table public.creator_service_orders enable row level security;
alter table public.creator_service_order_events enable row level security;

drop policy if exists "Service participants read orders" on public.creator_service_orders;
create policy "Service participants read orders" on public.creator_service_orders for select
  using (buyer_user_id=auth.uid() or seller_user_id=auth.uid() or public.is_artist_wallet_admin());
drop policy if exists "Service participants read events" on public.creator_service_order_events;
create policy "Service participants read events" on public.creator_service_order_events for select
  using (exists(select 1 from public.creator_service_orders o where o.id=service_order_id and (o.buyer_user_id=auth.uid() or o.seller_user_id=auth.uid())) or public.is_artist_wallet_admin());

revoke insert,update,delete on public.creator_service_orders from anon,authenticated;
revoke insert,update,delete on public.creator_service_order_events from anon,authenticated;

create or replace function public.release_creator_service_earnings(p_service_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.creator_service_orders%rowtype;
begin
  select * into v_order from public.creator_service_orders
  where id=p_service_order_id for update;
  if not found or v_order.status <> 'delivered' then return false; end if;

  update public.commerce_seller_settlements
  set settlement_status='posted', updated_at=now()
  where order_id=v_order.order_id and seller_user_id=v_order.seller_user_id
    and settlement_status='held_service';
  if not found then return false; end if;

  update public.artist_ledger_entries
  set status='posted', effective_at=now()
  where source_table='orders' and source_id=v_order.order_id
    and artist_user_id=v_order.seller_user_id and entry_type='sale_credit'
    and status='pending';
  if not found then raise exception 'pending creator earnings entry missing'; end if;

  update public.creator_service_orders
  set status='completed', completed_at=now(), updated_at=now()
  where id=p_service_order_id;
  return true;
end;
$$;

revoke all on function public.release_creator_service_earnings(uuid) from public,anon,authenticated;
grant execute on function public.release_creator_service_earnings(uuid) to service_role;

-- Freeze the selected Creator Marketplace service package on the immutable
-- commerce order line. The canonical pack runner will detect this pack's new
-- digest and reapply it safely in environments where step 27 already ran.
alter table public.commerce_order_items
  add column if not exists service_package_snapshot jsonb;

create or replace function public.record_commerce_order_snapshot(
  p_order_reference text,
  p_items jsonb
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_item jsonb;
  v_product uuid;
  v_price uuid;
  v_licence uuid;
  v_line integer := 0;
  v_version integer;
  v_rights_summary text;
  v_terms jsonb;
begin
  select * into v_order from public.orders where reference = p_order_reference for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if exists (select 1 from public.commerce_order_items where order_id = v_order.id) then
    return (select count(*)::integer from public.commerce_order_items where order_id = v_order.id);
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_ORDER_ITEMS';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_line := v_line + 1;
    insert into public.commerce_products
      (sku, product_type, source_id, title, seller_user_id, tax_class, fulfillment_type)
    values
      (v_item->>'sku', v_item->>'productType', v_item->>'sourceId', v_item->>'title',
       nullif(v_item->>'sellerUserId','')::uuid, coalesce(v_item->>'taxClass','digital'),
       coalesce(v_item->>'fulfillmentType','digital'))
    on conflict (sku) do update set
      title = excluded.title,
      seller_user_id = coalesce(excluded.seller_user_id, public.commerce_products.seller_user_id),
      active = true,
      updated_at = now()
    returning id into v_product;

    select id into v_price from public.commerce_price_versions
    where product_id = v_product and amount = (v_item->>'unitAmount')::numeric
      and currency = lower(v_item->>'currency') order by version desc limit 1;
    if v_price is null then
      select coalesce(max(version),0)+1 into v_version from public.commerce_price_versions where product_id=v_product;
      insert into public.commerce_price_versions(product_id,version,amount,currency)
      values(v_product,v_version,(v_item->>'unitAmount')::numeric,lower(v_item->>'currency'))
      returning id into v_price;
    end if;

    v_licence := null;
    if nullif(v_item->>'licenceCode','') is not null then
      v_rights_summary := coalesce(v_item->>'licenceSummary', v_item->>'rightsSummary', '');
      v_terms := jsonb_build_object(
        'text', coalesce(v_item->>'licenceTerms',''),
        'termsVersion', v_item->>'licenceTermsVersion',
        'templateVersion', v_item->>'licenceTemplateVersion',
        'licenceOptionId', v_item->>'licenceOptionId'
      );
      select id into v_licence from public.commerce_licence_versions
      where product_id=v_product and licence_code=v_item->>'licenceCode'
        and rights_summary=v_rights_summary
        and terms=v_terms
      order by version desc limit 1;
      if v_licence is null then
        select coalesce(max(version),0)+1 into v_version from public.commerce_licence_versions where product_id=v_product;
        insert into public.commerce_licence_versions
          (product_id,version,licence_code,licence_name,rights_summary,terms)
        values(
          v_product,
          v_version,
          v_item->>'licenceCode',
          coalesce(v_item->>'licenceName',v_item->>'licenceCode'),
          v_rights_summary,
          v_terms
        )
        returning id into v_licence;
      end if;
    end if;

    insert into public.commerce_order_items
      (order_id,line_number,product_id,price_version_id,licence_version_id,sku_snapshot,
       title_snapshot,product_type_snapshot,seller_user_id_snapshot,unit_amount,quantity,
       currency,tax_class_snapshot,fulfillment_snapshot,licence_snapshot,
       service_package_snapshot,seller_plan_id_snapshot,commission_bps_snapshot,
       marketplace_policy_version_snapshot)
    values
      (v_order.id,v_line,v_product,v_price,v_licence,v_item->>'sku',v_item->>'title',
       v_item->>'productType',nullif(v_item->>'sellerUserId','')::uuid,
       (v_item->>'unitAmount')::numeric,(v_item->>'quantity')::integer,lower(v_item->>'currency'),
       coalesce(v_item->>'taxClass','digital'),coalesce(v_item->>'fulfillmentType','digital'),
       case when v_licence is null then null else jsonb_build_object(
         'optionId',v_item->>'licenceOptionId',
         'code',v_item->>'licenceCode',
         'templateVersion',v_item->>'licenceTemplateVersion',
         'termsVersion',v_item->>'licenceTermsVersion',
         'summary',coalesce(v_item->>'licenceSummary',''),
         'terms',coalesce(v_item->>'licenceTerms','')) end,
       case
         when jsonb_typeof(v_item->'servicePackageSnapshot')='object'
           then v_item->'servicePackageSnapshot'
         else null
       end,
       nullif(v_item->>'sellerPlanId',''),
       nullif(v_item->>'marketplaceCommissionBps','')::integer,
       nullif(v_item->>'marketplacePolicyVersion',''));
  end loop;
  return v_line;
end;
$$;
