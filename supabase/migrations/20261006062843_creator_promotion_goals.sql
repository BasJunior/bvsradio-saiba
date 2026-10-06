-- Recognition and promotion only. No reward credits or affiliate liabilities.
create table public.creator_promotion_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_kind text not null check (item_kind in ('track','beat','episode')),
  item_id uuid not null,
  created_at timestamptz not null default now(),
  unique(user_id,item_kind,item_id)
);
create table public.creator_promotion_visits (
  link_id uuid not null references public.creator_promotion_links(id) on delete cascade,
  visitor_hash text not null check (length(visitor_hash)=64),
  visit_day date not null default current_date,
  primary key(link_id,visitor_hash,visit_day)
);
create table public.creator_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_id text not null check (badge_id in ('first_release','beat_maker','on_air','first_audience','first_100','first_sale','launch','momentum','breakthrough')),
  earned_at timestamptz not null default now(),
  primary key(user_id,badge_id)
);
alter table public.creator_promotion_links enable row level security;
alter table public.creator_promotion_visits enable row level security;
alter table public.creator_achievements enable row level security;
revoke all on public.creator_promotion_links,public.creator_promotion_visits,public.creator_achievements from public,anon,authenticated;
grant select,insert,update,delete on public.creator_promotion_links,public.creator_promotion_visits,public.creator_achievements to service_role;

create function public.creator_growth_metrics(owner_id uuid, content_kind text)
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
     and not exists(select 1 from auth.users u where u.id=owner_id and lower(u.email)=lower(o.customer_email))
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
revoke all on function public.creator_growth_metrics(uuid,text) from public,anon,authenticated;
grant execute on function public.creator_growth_metrics(uuid,text) to service_role;

create function public.creator_promotion_results(owner_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'kind',p.item_kind,'itemId',p.item_id,
   'visits',(select count(distinct v.visitor_hash) from public.creator_promotion_visits v where v.link_id=p.id),
   'plays',(select count(distinct coalesce(a.properties->>'visitor_id',a.session_id)) from public.analytics_events a
     where a.properties->>'promotion_id'=p.id::text and a.event_name='player_start'),
   'saves',(select count(distinct coalesce(a.properties->>'visitor_id',a.session_id)) from public.analytics_events a
     where a.properties->>'promotion_id'=p.id::text and a.event_name in ('track_save','beat_save'))
 )),'[]'::jsonb) from public.creator_promotion_links p where p.user_id=owner_id;
$$;
revoke all on function public.creator_promotion_results(uuid) from public,anon,authenticated;
grant execute on function public.creator_promotion_results(uuid) to service_role;
create index analytics_promotion_id_idx on public.analytics_events ((properties->>'promotion_id')) where properties ? 'promotion_id';
