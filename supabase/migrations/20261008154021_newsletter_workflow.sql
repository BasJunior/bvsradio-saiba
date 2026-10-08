create table public.newsletter_subscribers (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null unique references auth.users(id) on delete cascade,
 email text not null,
 audience text not null check(audience in ('listener','artist','producer')),
 is_active boolean not null default false,
 subscribed_at timestamptz,
 unsubscribed_at timestamptz,
 consent_version text not null default 'newsletter-v1',
 updated_at timestamptz not null default now()
);
create table public.newsletter_campaigns (
 id uuid primary key default gen_random_uuid(),
 subject text not null check(length(subject) between 1 and 150),
 body text not null check(length(body) between 1 and 10000),
 cta_label text not null,
 cta_path text not null,
 audience text not null check(audience in ('all','listener','artist','producer')),
 status text not null default 'draft' check(status in ('draft','sending','sent')),
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.newsletter_deliveries (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.newsletter_campaigns(id) on delete cascade,
 subscriber_id uuid not null references public.newsletter_subscribers(id) on delete cascade,
 status text not null default 'queued' check(status in ('queued','sending','sent','suppressed','uncertain')),
 sent_at timestamptz,
 clicked_at timestamptz,
 error text,
 created_at timestamptz not null default now(),
 unique(campaign_id,subscriber_id)
);
create index newsletter_delivery_queue on public.newsletter_deliveries(campaign_id,status,created_at);
alter table public.newsletter_subscribers enable row level security;
alter table public.newsletter_campaigns enable row level security;
alter table public.newsletter_deliveries enable row level security;
revoke all on public.newsletter_subscribers,public.newsletter_campaigns,public.newsletter_deliveries from anon,authenticated;
grant all on public.newsletter_subscribers,public.newsletter_campaigns,public.newsletter_deliveries to service_role;
create function public.queue_newsletter_campaign(campaign uuid, revision timestamptz, reviewed_count integer)
returns integer language plpgsql security invoker set search_path=public as $$
declare c public.newsletter_campaigns; n integer;
begin
 select * into c from public.newsletter_campaigns where id=campaign for update;
 if c.id is null or c.status<>'draft' or c.updated_at<>revision then raise exception 'Campaign changed. Review it again.'; end if;
 select count(*) into n from public.newsletter_subscribers where is_active and (c.audience='all' or audience=c.audience);
 if n=0 or n<>reviewed_count then raise exception 'Audience changed or empty. Review it again.'; end if;
 insert into public.newsletter_deliveries(campaign_id,subscriber_id)
 select c.id,id from public.newsletter_subscribers where is_active and (c.audience='all' or audience=c.audience);
 update public.newsletter_campaigns set status='sending',updated_at=now() where id=c.id;
 return n;
end $$;
revoke all on function public.queue_newsletter_campaign(uuid,timestamptz,integer) from public,anon,authenticated;
grant execute on function public.queue_newsletter_campaign(uuid,timestamptz,integer) to service_role;
