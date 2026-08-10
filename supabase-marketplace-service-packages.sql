-- BVS Creator Marketplace service package snapshot v1
-- Run after marketplace-economics and marketplace-services.
-- Safe to rerun.

alter table public.commerce_order_items
  add column if not exists service_package_snapshot jsonb;

-- Replace the commerce snapshot RPC so a selected creator-service package is
-- frozen on the immutable order line. Future seller edits must never rewrite
-- the package, price or scope a buyer purchased.
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
