-- Server passes the verified identity email; service_role cannot read auth.users.
drop function public.creator_growth_metrics(uuid,text);
create function public.creator_growth_metrics(owner_id uuid, content_kind text, owner_email text)
returns jsonb language sql stable security invoker set search_path='' as $$
 with live_items as (
   select id,'track' as kind,coalesce(reviewed_at,created_at) as published from public.tracks where user_id=owner_id and is_public and editorial_status='approved'
   union all select id,'beat',coalesce(published_at,created_at) from public.beats where producer_user_id=owner_id and is_public and status='published' and rights_confirmed
   union all select e.id,'episode',coalesce(e.published_at,e.created_at) from public.show_episodes e
     join public.show_creator_profiles s on s.id=e.show_id and s.status='approved'
     where e.creator_id=owner_id and e.status='published'
 ), valid_sales as (
   select distinct o.id from public.commerce_order_items i join public.orders o on o.id=i.order_id
     join public.commerce_payment_events pe on pe.id=o.paid_payment_event_id and pe.verified and pe.reconciled
   where i.seller_user_id_snapshot=owner_id and i.unit_amount>0 and ((content_kind='beat' and i.product_type_snapshot='beat') or (content_kind='track' and i.product_type_snapshot in ('single','mix','album'))) and o.status in ('paid','fulfilled')
     and o.paid_payment_event_id is not null and o.customer_user_id is distinct from owner_id
     and lower(o.customer_email) is distinct from lower(owner_email)
     and not exists(select 1 from public.commerce_refund_events r where r.order_id=o.id)
 ), audience as (
   select count(distinct q.user_id) n from public.stream_qualifications q
   join live_items l on l.id=q.track_id and l.kind='track'
   where q.status in ('eligible','settled') and q.user_id is not null and q.user_id<>owner_id
 )
 select jsonb_build_object(
   'live',(select count(*) from live_items where kind=content_kind),
   'promotions',(select count(*) from public.creator_promotion_links p join live_items l on l.id=p.item_id and l.kind=p.item_kind where p.user_id=owner_id and l.kind=content_kind),
   'listeners',(select n from audience),
   'sales',(select count(*) from valid_sales),
   'activeWeeks',(select count(distinct date_trunc('week',published at time zone 'UTC')) from live_items where kind=content_kind)
 );
$$;
revoke all on function public.creator_growth_metrics(uuid,text,text) from public,anon,authenticated;
grant execute on function public.creator_growth_metrics(uuid,text,text) to service_role;

