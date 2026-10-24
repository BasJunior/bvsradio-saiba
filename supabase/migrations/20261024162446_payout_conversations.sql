-- Private payout conversations. All access goes through authenticated server routes.
alter table public.artist_payout_requests
 add column if not exists confirmed_account_holder_name text,
 add column if not exists holder_confirmed_at timestamptz;
create table public.artist_payout_messages (
 id uuid primary key,
 payout_request_id uuid not null references public.artist_payout_requests(id) on delete cascade,
 artist_user_id uuid not null references public.profiles(id),
 author_user_id uuid not null references public.profiles(id),
 author_kind text not null check(author_kind in ('creator','staff')),
 body text not null check(length(btrim(body)) between 1 and 2000),
 confirmed_name text check(confirmed_name is null or length(btrim(confirmed_name)) between 2 and 160),
 created_at timestamptz not null default now(),
 recipient_read_at timestamptz,
 email_state text not null default 'pending' check(email_state in ('pending','sending','sent','failed')),
 email_attempts integer not null default 0,
 email_attempted_at timestamptz,
 email_sent_at timestamptz
);
create index artist_payout_messages_request_idx on public.artist_payout_messages(payout_request_id,created_at,id);
create index artist_payout_messages_artist_idx on public.artist_payout_messages(artist_user_id,created_at desc);
create index artist_payout_messages_author_idx on public.artist_payout_messages(author_user_id,created_at desc);
alter table public.artist_payout_messages enable row level security;
revoke all on public.artist_payout_messages from public,anon,authenticated;
grant select,insert,update,delete on public.artist_payout_messages to service_role;

create function public.send_artist_payout_message(p_id uuid,p_request_id uuid,p_actor_id uuid,p_author_kind text,p_body text,p_holder_name text default null)
returns public.artist_payout_messages language plpgsql security invoker set search_path='' as $$
declare r public.artist_payout_requests%rowtype; m public.artist_payout_messages%rowtype; v_body text; v_name text;
begin
 select * into r from public.artist_payout_requests where id=p_request_id for update;
 if not found then raise exception 'Payout request not found.' using errcode='P0002'; end if;
 if p_actor_id is null or p_author_kind is null or p_author_kind not in ('creator','staff') then raise exception 'Invalid sender.' using errcode='42501'; end if;
 if p_author_kind='creator' and p_actor_id <> r.artist_user_id then raise exception 'Payout request not found.' using errcode='42501'; end if;
 if p_author_kind='staff' and not (
 exists(select 1 from public.profiles where id=p_actor_id and role='admin') or
 exists(select 1 from public.editorial_staff where user_id=p_actor_id and active and role in ('founder','administrator','commerce_manager'))
 ) then raise exception 'Wallet permission required.' using errcode='42501'; end if;
 select * into m from public.artist_payout_messages where id=p_id;
 if found then
  if m.payout_request_id<>p_request_id or m.author_user_id<>p_actor_id or m.author_kind<>p_author_kind
   or coalesce(m.confirmed_name,'')<>coalesce(nullif(btrim(p_holder_name),''),'')
   or (m.confirmed_name is null and m.body<>btrim(coalesce(p_body,''))) then
   raise exception 'Message retry does not match the original.' using errcode='22023';
  end if;
  return m;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_actor_id::text,74292));
 if (select count(*) from public.artist_payout_messages where author_user_id=p_actor_id and created_at>now()-interval '1 minute')>=6 then
  raise exception 'Please wait a minute before sending another message.' using errcode='P0001'; end if;
 v_name:=nullif(btrim(p_holder_name),'');
 if v_name is not null then
  if p_author_kind<>'creator' or r.status not in ('requested','approved','processing') then raise exception 'Only the creator can confirm a name for an active payout.' using errcode='42501'; end if;
  if length(v_name) not between 2 and 160 or v_name ~ '[[:cntrl:]]' then raise exception 'Enter the full name registered to your payout account.' using errcode='22023'; end if;
  update public.artist_payout_requests set confirmed_account_holder_name=v_name,holder_confirmed_at=now() where id=r.id;
  v_body:='I confirm that the name registered to my selected payout account is: '||v_name;
 else v_body:=btrim(coalesce(p_body,'')); end if;
 if length(v_body) not between 1 and 2000 then raise exception 'Write a message of up to 2,000 characters.' using errcode='22023'; end if;
 insert into public.artist_payout_messages(id,payout_request_id,artist_user_id,author_user_id,author_kind,body,confirmed_name)
 values(p_id,r.id,r.artist_user_id,p_actor_id,p_author_kind,v_body,v_name) returning * into m;
 insert into public.editorial_audit_log(actor_id,action,entity_type,entity_id,details)
 values(p_actor_id,case when v_name is null then 'payout_message_sent' else 'payout_holder_confirmed' end,'artist_payout_request',r.id::text,jsonb_build_object('message_id',p_id,'author_kind',p_author_kind));
 return m;
end $$;
revoke all on function public.send_artist_payout_message(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.send_artist_payout_message(uuid,uuid,uuid,text,text,text) to service_role;

create function public.claim_payout_message_emails(p_id uuid default null)
returns setof public.artist_payout_messages language sql security invoker set search_path='' as $$
 update public.artist_payout_messages set email_state='sending',email_attempts=email_attempts+1,email_attempted_at=now()
 where id in (
  select id from public.artist_payout_messages
  where (p_id is null or id=p_id) and email_attempts<5
   and (email_state in ('pending','failed') or (email_state='sending' and email_attempted_at<now()-interval '5 minutes'))
   and (email_attempted_at is null or email_attempted_at<now()-interval '5 minutes')
  order by created_at limit 10 for update skip locked
 ) returning *;
$$;
revoke all on function public.claim_payout_message_emails(uuid) from public,anon,authenticated;
grant execute on function public.claim_payout_message_emails(uuid) to service_role;
