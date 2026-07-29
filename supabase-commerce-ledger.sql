-- BVS commerce ledger: canonical products, immutable order snapshots, payment events

alter table public.orders add column if not exists currency text not null default 'usd';
alter table public.orders add column if not exists paid_at timestamptz;
alter table public.orders add column if not exists paid_payment_event_id uuid;

create table if not exists public.commerce_products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  product_type text not null check (product_type in ('single','mix','album','beat','service')),
  source_id text,
  title text not null,
  seller_user_id uuid references auth.users(id) on delete set null,
  tax_class text not null default 'digital',
  fulfillment_type text not null default 'digital',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commerce_price_versions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.commerce_products(id),
  version integer not null,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null check (currency = lower(currency) and char_length(currency) = 3),
  created_at timestamptz not null default now(),
  unique (product_id, version)
);

create table if not exists public.commerce_licence_versions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.commerce_products(id),
  version integer not null,
  licence_code text not null,
  licence_name text not null,
  rights_summary text not null default '',
  terms jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (product_id, version)
);

create table if not exists public.commerce_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  line_number integer not null check (line_number > 0),
  product_id uuid not null references public.commerce_products(id),
  price_version_id uuid not null references public.commerce_price_versions(id),
  licence_version_id uuid references public.commerce_licence_versions(id),
  sku_snapshot text not null,
  title_snapshot text not null,
  product_type_snapshot text not null,
  seller_user_id_snapshot uuid,
  unit_amount numeric(12,2) not null,
  quantity integer not null check (quantity between 1 and 20),
  currency text not null,
  tax_class_snapshot text not null,
  fulfillment_snapshot text not null,
  licence_snapshot jsonb,
  created_at timestamptz not null default now(),
  unique (order_id, line_number)
);

create table if not exists public.commerce_payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('stripe','paynow')),
  provider_event_id text not null,
  order_id uuid references public.orders(id) on delete restrict,
  order_reference text not null,
  event_type text not null,
  provider_status text not null,
  amount numeric(12,2),
  currency text,
  provider_reference text,
  payload_sha256 text not null,
  verified boolean not null,
  reconciled boolean not null,
  reconciliation_error text,
  received_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create index if not exists commerce_order_items_order_idx on public.commerce_order_items(order_id);
create index if not exists commerce_payment_events_order_idx on public.commerce_payment_events(order_id, received_at);

alter table public.orders
  drop constraint if exists orders_paid_payment_event_fk;
alter table public.orders
  add constraint orders_paid_payment_event_fk foreign key (paid_payment_event_id)
  references public.commerce_payment_events(id) on delete set null;

create or replace function public.commerce_immutable_row()
returns trigger language plpgsql as $$
begin
  raise exception 'COMMERCE_LEDGER_IMMUTABLE';
end;
$$;

drop trigger if exists commerce_price_versions_immutable on public.commerce_price_versions;
create trigger commerce_price_versions_immutable before update or delete on public.commerce_price_versions
for each row execute function public.commerce_immutable_row();
drop trigger if exists commerce_licence_versions_immutable on public.commerce_licence_versions;
create trigger commerce_licence_versions_immutable before update or delete on public.commerce_licence_versions
for each row execute function public.commerce_immutable_row();
drop trigger if exists commerce_order_items_immutable on public.commerce_order_items;
create trigger commerce_order_items_immutable before update or delete on public.commerce_order_items
for each row execute function public.commerce_immutable_row();
drop trigger if exists commerce_payment_events_immutable on public.commerce_payment_events;
create trigger commerce_payment_events_immutable before update or delete on public.commerce_payment_events
for each row execute function public.commerce_immutable_row();

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
      title = excluded.title, active = true, updated_at = now()
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
      select id into v_licence from public.commerce_licence_versions
      where product_id=v_product and licence_code=v_item->>'licenceCode'
        and rights_summary=coalesce(v_item->>'rightsSummary','')
        and terms=coalesce(v_item->'terms','{}'::jsonb)
      order by version desc limit 1;
      if v_licence is null then
        select coalesce(max(version),0)+1 into v_version from public.commerce_licence_versions where product_id=v_product;
        insert into public.commerce_licence_versions
          (product_id,version,licence_code,licence_name,rights_summary,terms)
        values(v_product,v_version,v_item->>'licenceCode',coalesce(v_item->>'licenceName',v_item->>'licenceCode'),
          coalesce(v_item->>'rightsSummary',''),coalesce(v_item->'terms','{}'::jsonb))
        returning id into v_licence;
      end if;
    end if;

    insert into public.commerce_order_items
      (order_id,line_number,product_id,price_version_id,licence_version_id,sku_snapshot,
       title_snapshot,product_type_snapshot,seller_user_id_snapshot,unit_amount,quantity,
       currency,tax_class_snapshot,fulfillment_snapshot,licence_snapshot)
    values
      (v_order.id,v_line,v_product,v_price,v_licence,v_item->>'sku',v_item->>'title',
       v_item->>'productType',nullif(v_item->>'sellerUserId','')::uuid,
       (v_item->>'unitAmount')::numeric,(v_item->>'quantity')::integer,lower(v_item->>'currency'),
       coalesce(v_item->>'taxClass','digital'),coalesce(v_item->>'fulfillmentType','digital'),
       case when v_licence is null then null else jsonb_build_object(
         'code',v_item->>'licenceCode','name',v_item->>'licenceName',
         'rightsSummary',coalesce(v_item->>'rightsSummary',''),'terms',coalesce(v_item->'terms','{}'::jsonb)) end);
  end loop;
  return v_line;
end;
$$;

create or replace function public.record_verified_payment_event(
  p_provider text, p_provider_event_id text, p_order_reference text,
  p_event_type text, p_provider_status text, p_amount numeric, p_currency text,
  p_provider_reference text, p_payload_sha256 text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_event uuid;
  v_error text;
begin
  select * into v_order from public.orders where reference=p_order_reference for update;
  if not found then return jsonb_build_object('accepted',false,'error','ORDER_NOT_FOUND'); end if;
  if not exists (select 1 from public.commerce_order_items where order_id=v_order.id) then
    return jsonb_build_object('accepted',false,'error','ORDER_SNAPSHOT_MISSING');
  end if;
  if p_provider not in ('stripe','paynow') then raise exception 'INVALID_PROVIDER'; end if;
  if lower(coalesce(p_currency,'')) <> lower(v_order.currency) then v_error := 'CURRENCY_MISMATCH';
  elsif abs(coalesce(p_amount,-1)-v_order.total) > 0.01 then v_error := 'AMOUNT_MISMATCH';
  elsif coalesce(p_provider_reference,'') <> v_order.reference then v_error := 'REFERENCE_MISMATCH';
  end if;

  insert into public.commerce_payment_events
    (provider,provider_event_id,order_id,order_reference,event_type,provider_status,
     amount,currency,provider_reference,payload_sha256,verified,reconciled,reconciliation_error)
  values(p_provider,p_provider_event_id,v_order.id,v_order.reference,p_event_type,p_provider_status,
    p_amount,lower(p_currency),p_provider_reference,p_payload_sha256,true,v_error is null,v_error)
  on conflict(provider,provider_event_id) do nothing returning id into v_event;
  if v_event is null then return jsonb_build_object('accepted',true,'duplicate',true,'transitioned',false); end if;
  if v_error is not null then return jsonb_build_object('accepted',false,'reconciled',false,'error',v_error); end if;
  if v_order.status in ('paid','fulfilled') then return jsonb_build_object('accepted',true,'duplicate',true,'transitioned',false); end if;

  update public.orders set status='paid',delivery_status='paid_processing',
    paid_at=now(),paid_payment_event_id=v_event,updated_at=now()
  where id=v_order.id;
  return jsonb_build_object('accepted',true,'reconciled',true,'transitioned',true,'eventId',v_event);
end;
$$;

alter table public.commerce_products enable row level security;
alter table public.commerce_price_versions enable row level security;
alter table public.commerce_licence_versions enable row level security;
alter table public.commerce_order_items enable row level security;
alter table public.commerce_payment_events enable row level security;

revoke all on function public.record_commerce_order_snapshot(text,jsonb) from public,anon,authenticated;
revoke all on function public.record_verified_payment_event(text,text,text,text,text,numeric,text,text,text) from public,anon,authenticated;
grant execute on function public.record_commerce_order_snapshot(text,jsonb) to service_role;
grant execute on function public.record_verified_payment_event(text,text,text,text,text,numeric,text,text,text) to service_role;
