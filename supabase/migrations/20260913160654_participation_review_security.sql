-- Participation final review. All browser reads go through authenticated/visibility-aware
-- Next.js routes; no client component reads these tables directly.
BEGIN;
REVOKE SELECT ON public.participation_threads, public.participation_messages,
  public.participation_reactions, public.participation_notifications,
  public.participation_reports, public.participation_pulse_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.participation_threads, public.participation_messages,
  public.participation_reactions, public.participation_notifications,
  public.participation_reports, public.participation_pulse_runs TO service_role;

-- A deleted account can leave anonymized discussions behind. RPC creation still
-- requires p_actor, so this only permits the existing ON DELETE SET NULL action.
DO $$ DECLARE c RECORD; BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public.participation_threads'::regclass
    AND contype='c' AND pg_get_constraintdef(oid) LIKE '%thread_type%'
    AND pg_get_constraintdef(oid) LIKE '%author_user_id IS NOT NULL%'
  LOOP EXECUTE format('ALTER TABLE public.participation_threads DROP CONSTRAINT %I', c.conname); END LOOP;
END $$;
ALTER TABLE public.participation_threads DROP CONSTRAINT IF EXISTS participation_threads_valid_kind;
ALTER TABLE public.participation_threads ADD CONSTRAINT participation_threads_valid_kind CHECK (
  (thread_type='post' AND intent IS NOT NULL) OR
  (thread_type='content' AND object_kind IS NOT NULL AND object_id IS NOT NULL)
);

CREATE OR REPLACE FUNCTION public.moderate_participation_report(p_staff UUID,p_report UUID,p_action TEXT,p_reason TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.participation_reports%ROWTYPE; audit_id UUID; affected INTEGER; now_at TIMESTAMPTZ := NOW();
BEGIN
  -- This RPC is service-role only; the route derives staff from trusted editorialIdentity.
  IF p_staff IS NULL OR p_action NOT IN ('review','hide','restore','lock','unlock','delete','resolve_report','dismiss_report') THEN RAISE EXCEPTION 'invalid moderation action'; END IF;
  IF p_action <> 'review' AND (p_reason IS NULL OR char_length(trim(p_reason)) NOT BETWEEN 1 AND 500) THEN RAISE EXCEPTION 'moderation reason required'; END IF;
  SELECT * INTO r FROM public.participation_reports WHERE id=p_report FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'report not found'; END IF;
  IF p_action IN ('hide','restore','delete') THEN
    IF r.message_id IS NOT NULL THEN
      UPDATE public.participation_messages SET
        status=CASE p_action WHEN 'hide' THEN 'hidden' WHEN 'restore' THEN 'published' ELSE 'deleted' END,
        body=CASE WHEN p_action='delete' THEN 'Removed by BVS moderation.' ELSE body END,
        deleted_at=CASE WHEN p_action='delete' THEN now_at ELSE NULL END,updated_at=now_at
      WHERE id=r.message_id;
    ELSE
      UPDATE public.participation_threads SET
        status=CASE p_action WHEN 'hide' THEN 'hidden' WHEN 'restore' THEN 'published' ELSE 'deleted' END,
        moderation_reason=CASE WHEN p_action='restore' THEN NULL ELSE p_reason END,
        deleted_at=CASE WHEN p_action='delete' THEN now_at ELSE NULL END,updated_at=now_at
      WHERE id=r.thread_id;
    END IF;
    GET DIAGNOSTICS affected=ROW_COUNT;
    IF affected <> 1 THEN RAISE EXCEPTION 'moderation target missing'; END IF;
  ELSIF p_action IN ('lock','unlock') THEN
    UPDATE public.participation_threads SET status=CASE WHEN p_action='lock' THEN 'locked' ELSE 'published' END,
      moderation_reason=CASE WHEN p_action='lock' THEN p_reason ELSE NULL END,updated_at=now_at WHERE id=r.thread_id;
    GET DIAGNOSTICS affected=ROW_COUNT;
    IF affected <> 1 THEN RAISE EXCEPTION 'moderation target missing'; END IF;
  END IF;
  UPDATE public.participation_reports SET
    status=CASE p_action WHEN 'resolve_report' THEN 'resolved' WHEN 'dismiss_report' THEN 'dismissed' ELSE 'reviewing' END,
    review_owner_user_id=p_staff,
    reviewed_at=CASE WHEN p_action IN ('resolve_report','dismiss_report') THEN now_at ELSE reviewed_at END
    WHERE id=r.id;
  IF p_action <> 'review' THEN
    INSERT INTO public.participation_moderation_audit(staff_user_id,action,thread_id,message_id,report_id,reason)
    VALUES(p_staff,p_action,r.thread_id,r.message_id,r.id,p_reason) RETURNING id INTO audit_id;
    INSERT INTO public.participation_domain_events(source_key,event_type,actor_user_id,thread_id,message_id,payload)
    VALUES('moderation:'||audit_id,'thread_moderated',p_staff,r.thread_id,r.message_id,
      jsonb_build_object('report_id',r.id,'action',p_action,'reported_user_id',r.reported_user_id,'reason',p_reason));
  END IF;
  RETURN jsonb_build_object('ok',true,'action',p_action,'reportId',r.id);
END $$;
REVOKE ALL ON FUNCTION public.moderate_participation_report(UUID,UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.moderate_participation_report(UUID,UUID,TEXT,TEXT) TO service_role;
COMMIT;
