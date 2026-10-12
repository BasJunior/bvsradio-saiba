-- Additive first-party ranking/measurement. Does not enqueue or send notifications.
BEGIN;
CREATE TABLE IF NOT EXISTS public.notification_engagement_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_active_at timestamptz,
  active_entity_key text CHECK (char_length(active_entity_key) <= 160),
  active_at timestamptz,
  motivation_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.notification_interactions (
  notification_id uuid NOT NULL REFERENCES public.participation_notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event text NOT NULL CHECK (event IN ('notification_opened','deeplink_opened','destination_loaded','primary_action_completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(notification_id,user_id,event)
);
CREATE INDEX IF NOT EXISTS notification_interactions_user_time ON public.notification_interactions(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS public.notification_decisions (
  notification_id uuid PRIMARY KEY REFERENCES public.participation_notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model_version text NOT NULL DEFAULT 'heuristic-v1',
  mode text NOT NULL CHECK (mode IN ('shadow')),
  category text NOT NULL,
  action text NOT NULL CHECK (action IN ('push','inbox','defer')),
  reason text NOT NULL CHECK (char_length(reason) <= 80),
  score double precision NOT NULL CHECK (score >= 0 AND score <= 1000),
  evaluated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notification_decisions_user_time ON public.notification_decisions(user_id,evaluated_at DESC);
ALTER TABLE public.notification_engagement_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_decisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_engagement_profiles,public.notification_interactions,public.notification_decisions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.notification_engagement_profiles,public.notification_interactions,public.notification_decisions TO service_role;

-- Only trusted server code supplies the authenticated account; no public/client EXECUTE.
CREATE OR REPLACE FUNCTION public.record_notification_activity(p_user uuid,p_motivation text,p_entity text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF p_motivation NOT IN ('followed_artists','new_music','live_shows','creator_updates','commerce','community','recommendations','offers') THEN
    RAISE EXCEPTION 'Invalid motivation';
  END IF;
  INSERT INTO public.notification_engagement_profiles(user_id,last_active_at,active_entity_key,active_at,motivation_counts)
  VALUES(p_user,now(),p_entity,CASE WHEN p_entity IS NOT NULL THEN now() ELSE NULL END,jsonb_build_object(p_motivation,1))
  ON CONFLICT(user_id) DO UPDATE SET
    last_active_at=now(),updated_at=now(),
    active_entity_key=COALESCE(p_entity,notification_engagement_profiles.active_entity_key),
    active_at=CASE WHEN p_entity IS NOT NULL THEN now() ELSE notification_engagement_profiles.active_at END,
    motivation_counts=jsonb_set(notification_engagement_profiles.motivation_counts,ARRAY[p_motivation],
      to_jsonb(LEAST(1000,COALESCE((notification_engagement_profiles.motivation_counts->>p_motivation)::integer,0)+1)));
END $$;
REVOKE ALL ON FUNCTION public.record_notification_activity(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_notification_activity(uuid,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.record_notification_interaction(p_user uuid,p_notification uuid,p_event text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF p_event NOT IN ('notification_opened','deeplink_opened','destination_loaded','primary_action_completed') THEN
    RETURN false;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.participation_notifications WHERE id=p_notification AND recipient_user_id=p_user) THEN
    RETURN false;
  END IF;
  INSERT INTO public.notification_interactions(notification_id,user_id,event)
  VALUES(p_notification,p_user,p_event) ON CONFLICT DO NOTHING;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.record_notification_interaction(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_notification_interaction(uuid,uuid,text) TO service_role;
COMMIT;
