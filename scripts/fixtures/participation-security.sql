-- Executed only in the disposable cluster created by participation-security-db-tests.sh.
DO $$ DECLARE t UUID; m UUID; e UUID; r UUID; before_status TEXT; BEGIN
  INSERT INTO auth.users(id) VALUES ('10000000-0000-0000-0000-000000000001'),('10000000-0000-0000-0000-000000000002'),('10000000-0000-0000-0000-000000000003');
  SELECT thread_id,message_id,event_id INTO t,m,e FROM public.create_participation_post('10000000-0000-0000-0000-000000000001','update','Security fixture','fixture-key-1');
  INSERT INTO public.participation_reports(reporter_user_id,thread_id,reason) VALUES('10000000-0000-0000-0000-000000000002',t,'spam') RETURNING id INTO r;
  PERFORM public.moderate_participation_report('10000000-0000-0000-0000-000000000003',r,'hide','Test moderation');
  IF (SELECT status FROM public.participation_threads WHERE id=t) <> 'hidden' THEN RAISE EXCEPTION 'hide failed'; END IF;
  IF (SELECT count(*) FROM public.participation_moderation_audit WHERE report_id=r) <> 1 THEN RAISE EXCEPTION 'audit missing'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.participation_domain_events WHERE event_type='thread_moderated' AND thread_id=t) THEN RAISE EXCEPTION 'outbox missing'; END IF;
  -- Invalid staff causes the report FK write to fail after content mutation. Entire RPC must roll back.
  BEGIN
    PERFORM public.moderate_participation_report('10000000-0000-0000-0000-000000000099',r,'restore','Must roll back');
    RAISE EXCEPTION 'invalid staff unexpectedly succeeded';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  IF (SELECT status FROM public.participation_threads WHERE id=t) <> 'hidden' THEN RAISE EXCEPTION 'partial moderation committed'; END IF;
  DELETE FROM auth.users WHERE id='10000000-0000-0000-0000-000000000001';
  IF NOT EXISTS(SELECT 1 FROM public.participation_threads WHERE id=t AND author_user_id IS NULL) THEN RAISE EXCEPTION 'account deletion did not anonymize post'; END IF;
  IF has_function_privilege('authenticated','public.moderate_participation_report(uuid,uuid,text,text)','EXECUTE') THEN RAISE EXCEPTION 'client can moderate'; END IF;
  IF has_function_privilege('anon','public.create_participation_post(uuid,text,text,text,text,text,text,text,uuid[])','EXECUTE') THEN RAISE EXCEPTION 'anonymous client can post'; END IF;
END $$;
SET ROLE authenticated;
DO $$ DECLARE affected INTEGER; BEGIN
  BEGIN PERFORM body FROM public.participation_messages; RAISE EXCEPTION 'direct message access allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM moderation_reason FROM public.participation_threads; RAISE EXCEPTION 'direct moderation reason access allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM detail FROM public.participation_notifications; RAISE EXCEPTION 'direct notification access allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN UPDATE public.participation_notifications SET recipient_user_id='10000000-0000-0000-0000-000000000002'; GET DIAGNOSTICS affected=ROW_COUNT; IF affected <> 0 THEN RAISE EXCEPTION 'direct recipient mutation allowed'; END IF; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET ROLE anon;
DO $$ BEGIN
  BEGIN PERFORM body FROM public.participation_messages; RAISE EXCEPTION 'anonymous message access allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT 'PASS: moderation atomicity, private direct reads, RPC grants, recipient protection, account deletion' AS result;
