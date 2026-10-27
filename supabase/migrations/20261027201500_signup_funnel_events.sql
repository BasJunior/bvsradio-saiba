CREATE TABLE IF NOT EXISTS public.signup_funnel_events (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_step TEXT NOT NULL CHECK (event_step IN (
    'join_prompt_shown',
    'join_prompt_dismissed',
    'join_cta_clicked',
    'signup_page_viewed',
    'validation_failed',
    'submit_attempted',
    'submit_failed',
    'account_created',
    'confirmation_email_shown',
    'confirmation_resent',
    'confirmation_started',
    'confirmation_failed',
    'account_confirmed',
    'premium_options_shown',
    'premium_option_clicked'
  )),
  surface TEXT NOT NULL CHECK (surface IN ('web', 'ios', 'android')),
  path TEXT,
  funnel_id TEXT,
  role TEXT,
  context JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS signup_funnel_created_idx
  ON public.signup_funnel_events(created_at DESC);
CREATE INDEX IF NOT EXISTS signup_funnel_step_surface_idx
  ON public.signup_funnel_events(event_step, surface, created_at DESC);
CREATE INDEX IF NOT EXISTS signup_funnel_session_idx
  ON public.signup_funnel_events(funnel_id, created_at)
  WHERE funnel_id IS NOT NULL;

ALTER TABLE public.signup_funnel_events ENABLE ROW LEVEL SECURITY;
-- No browser policies: the server analytics endpoint writes with the service role.
