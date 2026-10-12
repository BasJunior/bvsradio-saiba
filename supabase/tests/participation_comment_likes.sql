-- Transactional smoke test against the deployed schema. No comments or likes
-- survive this test and it creates no notification/outbox events.
BEGIN;
DO $$
DECLARE v_actor UUID; v_author UUID; v_thread UUID := gen_random_uuid(); v_root UUID := gen_random_uuid(); v_comment UUID := gen_random_uuid(); v_reply UUID := gen_random_uuid();
BEGIN
  SELECT a.id, b.id INTO v_actor, v_author FROM auth.users a CROSS JOIN auth.users b
  WHERE a.id <> b.id AND a.email_confirmed_at IS NOT NULL AND b.email_confirmed_at IS NOT NULL
    AND (a.banned_until IS NULL OR a.banned_until <= NOW())
    AND NOT EXISTS (SELECT 1 FROM public.participation_blocks x WHERE
      (x.blocker_user_id=a.id AND x.blocked_user_id=b.id) OR (x.blocker_user_id=b.id AND x.blocked_user_id=a.id))
  LIMIT 1;
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Two confirmed, unblocked fixture actors required'; END IF;
  PERFORM set_config('bvs.like_actor',v_actor::TEXT,TRUE);
  PERFORM set_config('bvs.like_author',v_author::TEXT,TRUE);
  PERFORM set_config('bvs.like_thread',v_thread::TEXT,TRUE);
  PERFORM set_config('bvs.like_root',v_root::TEXT,TRUE);
  PERFORM set_config('bvs.like_comment',v_comment::TEXT,TRUE);
  PERFORM set_config('bvs.like_reply',v_reply::TEXT,TRUE);
  INSERT INTO public.participation_threads(id,thread_type,author_user_id,intent)
    VALUES(v_thread,'post',v_author,'update');
  INSERT INTO public.participation_messages(id,thread_id,author_user_id,message_kind,reply_to_id,body,client_key) VALUES
    (v_root,v_thread,v_author,'root',NULL,'Rollback-only like test',v_root::TEXT),
    (v_comment,v_thread,v_author,'comment',NULL,'Rollback-only comment',v_comment::TEXT),
    (v_reply,v_thread,v_author,'reply',v_comment,'Rollback-only nested reply',v_reply::TEXT);
END;
$$;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  a UUID := current_setting('bvs.like_actor')::UUID;
  b UUID := current_setting('bvs.like_author')::UUID;
  t UUID := current_setting('bvs.like_thread')::UUID;
  r UUID := current_setting('bvs.like_root')::UUID;
  c UUID := current_setting('bvs.like_comment')::UUID;
  n UUID := current_setting('bvs.like_reply')::UUID;
  result RECORD;
BEGIN
  SELECT * INTO result FROM public.set_participation_message_like(a,t,c,TRUE);
  IF NOT FOUND OR result.like_count<>1 OR NOT result.viewer_liked THEN RAISE EXCEPTION 'Initial like failed'; END IF;
  SELECT * INTO result FROM public.set_participation_message_like(a,t,c,TRUE);
  IF result.like_count<>1 THEN RAISE EXCEPTION 'Retry duplicated a like'; END IF;
  PERFORM public.set_participation_message_like(b,t,c,TRUE);
  SELECT * INTO result FROM public.participation_message_like_summary(ARRAY[c],a);
  IF result.like_count<>2 OR NOT result.viewer_liked THEN RAISE EXCEPTION 'Multiple viewers failed'; END IF;
  SELECT * INTO result FROM public.participation_message_like_summary(ARRAY[c],NULL);
  IF result.like_count<>2 OR result.viewer_liked THEN RAISE EXCEPTION 'Public counts leaked viewer state'; END IF;
  SELECT * INTO result FROM public.set_participation_message_like(a,t,c,FALSE);
  IF result.like_count<>1 OR result.viewer_liked THEN RAISE EXCEPTION 'Unlike failed'; END IF;
  SELECT * INTO result FROM public.set_participation_message_like(a,t,c,FALSE);
  IF result.like_count<>1 THEN RAISE EXCEPTION 'Repeated unlike changed another viewer'; END IF;
  SELECT * INTO result FROM public.set_participation_message_like(a,t,n,TRUE);
  IF NOT FOUND OR result.like_count<>1 THEN RAISE EXCEPTION 'Nested reply like failed'; END IF;
  PERFORM public.set_participation_message_like(a,t,r,TRUE);
  IF FOUND THEN RAISE EXCEPTION 'Root likes must stay in post reaction system'; END IF;
  PERFORM public.set_participation_message_like(a,gen_random_uuid(),c,TRUE);
  IF FOUND THEN RAISE EXCEPTION 'Cross-thread message ID accepted'; END IF;
  UPDATE public.participation_messages SET status='deleted' WHERE id=c;
  PERFORM public.set_participation_message_like(a,t,c,TRUE);
  IF FOUND THEN RAISE EXCEPTION 'Deleted comment accepted'; END IF;
  IF EXISTS(SELECT 1 FROM public.participation_message_like_summary(ARRAY[c],a)) THEN RAISE EXCEPTION 'Deleted comment count exposed'; END IF;
  UPDATE public.participation_messages SET status='published' WHERE id=c;
  UPDATE public.participation_threads SET status='hidden' WHERE id=t;
  PERFORM public.set_participation_message_like(a,t,c,TRUE);
  IF FOUND THEN RAISE EXCEPTION 'Hidden thread accepted'; END IF;
  UPDATE public.participation_threads SET status='locked' WHERE id=t;
  SELECT * INTO result FROM public.set_participation_message_like(a,t,c,TRUE);
  IF NOT FOUND THEN RAISE EXCEPTION 'Locked readable threads should still allow reactions'; END IF;
  INSERT INTO public.participation_blocks(blocker_user_id,blocked_user_id) VALUES(b,a);
  PERFORM public.set_participation_message_like(a,t,c,TRUE);
  IF FOUND THEN RAISE EXCEPTION 'Blocked pair accepted'; END IF;
  IF has_function_privilege('anon','public.set_participation_message_like(uuid,uuid,uuid,boolean)','EXECUTE')
    OR has_function_privilege('authenticated','public.participation_message_like_summary(uuid[],uuid)','EXECUTE')
    OR has_table_privilege('authenticated','public.participation_message_likes','INSERT')
    OR has_table_privilege('anon','public.participation_message_likes','SELECT') THEN
    RAISE EXCEPTION 'Direct client access must remain revoked';
  END IF;
END;
$$;
RESET ROLE;
ROLLBACK;
SELECT 'Comment like SQL tests passed as service_role; all fixtures rolled back.' AS verification;
