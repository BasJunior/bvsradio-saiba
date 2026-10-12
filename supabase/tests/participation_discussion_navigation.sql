BEGIN;
DO $$
DECLARE a UUID; b UUID; owner UUID; t UUID:=gen_random_uuid(); root UUID:=gen_random_uuid(); c UUID; first_comment UUID; i INTEGER;
BEGIN
  SELECT x.id,y.id,z.id INTO a,b,owner FROM auth.users x CROSS JOIN auth.users y CROSS JOIN auth.users z
  WHERE x.id<>y.id AND x.id<>z.id AND y.id<>z.id AND x.email_confirmed_at IS NOT NULL AND y.email_confirmed_at IS NOT NULL AND z.email_confirmed_at IS NOT NULL
  AND NOT EXISTS(SELECT 1 FROM public.participation_blocks k WHERE (k.blocker_user_id IN(x.id,y.id) AND k.blocked_user_id=z.id) OR (k.blocked_user_id IN(x.id,y.id) AND k.blocker_user_id=z.id))
  AND NOT EXISTS(SELECT 1 FROM public.participation_preferences p WHERE p.user_id=z.id AND NOT p.inbox_enabled) LIMIT 1;
  IF a IS NULL THEN RAISE EXCEPTION 'Three unblocked fixture actors required'; END IF;
  PERFORM set_config('bvs.discussion_actor',a::TEXT,TRUE);PERFORM set_config('bvs.discussion_second',b::TEXT,TRUE);PERFORM set_config('bvs.discussion_owner',owner::TEXT,TRUE);PERFORM set_config('bvs.discussion_thread',t::TEXT,TRUE);
  INSERT INTO public.participation_threads(id,thread_type,author_user_id,intent) VALUES(t,'post',owner,'update');
  INSERT INTO public.participation_messages(id,thread_id,author_user_id,message_kind,body,client_key) VALUES(root,t,owner,'root','Rollback-only discussion test',root::TEXT);
  FOR i IN 1..8 LOOP
    c:=gen_random_uuid(); IF i=1 THEN first_comment:=c; END IF;
    INSERT INTO public.participation_messages(id,thread_id,author_user_id,message_kind,reply_to_id,body,client_key,created_at)
      VALUES(c,t,owner,'reply',root,'Fixture comment '||i::TEXT,c::TEXT,NOW()+i*INTERVAL '1 second');
  END LOOP;
  PERFORM set_config('bvs.discussion_comment',first_comment::TEXT,TRUE);
END;
$$;
SET LOCAL ROLE service_role;
DO $$
DECLARE a UUID:=current_setting('bvs.discussion_actor')::UUID; b UUID:=current_setting('bvs.discussion_second')::UUID; owner UUID:=current_setting('bvs.discussion_owner')::UUID; t UUID:=current_setting('bvs.discussion_thread')::UUID; c UUID:=current_setting('bvs.discussion_comment')::UUID;
 p JSONB; q JSONB; ids UUID[]; e UUID; n public.participation_notifications; n2 public.participation_notifications;
BEGIN
  p:=public.participation_discussion_page(t,a,'oldest',3,NULL,NULL);
  IF jsonb_array_length(p->'messages')<>4 OR p->'next_cursor'='null'::JSONB THEN RAISE EXCEPTION 'Page size/root/cursor failed'; END IF;
  q:=public.participation_discussion_page(t,a,'oldest',3,p->'next_cursor',NULL);
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p->'messages') x JOIN jsonb_array_elements(q->'messages') y ON x->>'id'=y->>'id' WHERE x->>'message_kind'<>'root') THEN RAISE EXCEPTION 'Pagination repeated comments'; END IF;
  q:=public.participation_discussion_page(t,a,'newest',2,NULL,c);
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(q->'messages') x WHERE x->>'id'=c::TEXT) THEN RAISE EXCEPTION 'Shared comment focus missing'; END IF;
  PERFORM public.set_participation_message_like(a,t,c,TRUE);
  SELECT id INTO e FROM public.participation_domain_events WHERE thread_id=t AND message_id=c AND actor_user_id=a AND event_type='message_liked';
  IF e IS NULL THEN RAISE EXCEPTION 'Like did not create outbox event'; END IF;
  PERFORM public.set_participation_message_like(a,t,c,TRUE);
  IF (SELECT COUNT(*) FROM public.participation_domain_events WHERE thread_id=t AND actor_user_id=a AND event_type='message_liked')<>1 THEN RAISE EXCEPTION 'Retry created duplicate outbox event'; END IF;
  SELECT * INTO n FROM public.group_participation_comment_like(e,'Test member');
  IF NOT FOUND OR n.recipient_user_id<>owner OR n.target_href NOT LIKE '%#reply-%' THEN RAISE EXCEPTION 'Comment author notification/deep link failed'; END IF;
  SELECT * INTO n2 FROM public.group_participation_comment_like(e,'Test member');
  IF n.id<>n2.id THEN RAISE EXCEPTION 'Outbox replay created a second notification'; END IF;
  PERFORM public.set_participation_message_like(b,t,c,TRUE);
  SELECT id INTO e FROM public.participation_domain_events WHERE thread_id=t AND actor_user_id=b AND event_type='message_liked';
  SELECT * INTO n2 FROM public.group_participation_comment_like(e,'Another member');
  IF n.id<>n2.id OR n2.title<>'2 people liked your comment' THEN RAISE EXCEPTION 'Multiple likes not grouped'; END IF;
  p:=public.participation_discussion_page(t,a,'top',1,NULL,NULL);
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p->'messages') x WHERE x->>'id'=c::TEXT AND (x->>'like_count')::INTEGER=2) THEN RAISE EXCEPTION 'Top sort failed'; END IF;
  INSERT INTO public.participation_thread_subscriptions(user_id,thread_id,muted_at) VALUES(owner,t,NOW());
  IF EXISTS(SELECT 1 FROM public.group_participation_comment_like(e,'Another member')) THEN RAISE EXCEPTION 'Muted notification accepted'; END IF;
  DELETE FROM public.participation_thread_subscriptions WHERE user_id=owner AND thread_id=t;
  INSERT INTO public.participation_blocks(blocker_user_id,blocked_user_id) VALUES(owner,b);
  IF EXISTS(SELECT 1 FROM public.group_participation_comment_like(e,'Another member')) THEN RAISE EXCEPTION 'Blocked reaction notification accepted'; END IF;
  UPDATE public.participation_messages SET status='deleted' WHERE id=c;
  IF EXISTS(SELECT 1 FROM public.group_participation_comment_like(e,'Another member')) THEN RAISE EXCEPTION 'Deleted comment notified'; END IF;
  IF has_function_privilege('authenticated','public.participation_discussion_page(uuid,uuid,text,integer,jsonb,uuid)','EXECUTE') OR has_function_privilege('anon','public.group_participation_comment_like(uuid,text)','EXECUTE') THEN RAISE EXCEPTION 'Client RPC access allowed'; END IF;
END;
$$;
RESET ROLE;
ROLLBACK;
SELECT 'Discussion SQL tests passed; all fixture comments, likes, events and grouped notifications rolled back.' AS verification;
