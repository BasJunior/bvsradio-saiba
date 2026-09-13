-- Apply before deploying the final-review worker. No outbound activation.
ALTER TABLE public.participation_domain_events ADD COLUMN IF NOT EXISTS fanout_lease_until TIMESTAMPTZ;
ALTER TABLE public.participation_domain_events ADD COLUMN IF NOT EXISTS fanout_attempts INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS participation_fanout_recovery_idx ON public.participation_domain_events(fanout_lease_until) WHERE fanout_status = 'processing';
-- Recover pre-upgrade claims once. New claims always carry a lease.
UPDATE public.participation_domain_events SET fanout_status='failed' WHERE fanout_status='processing' AND fanout_lease_until IS NULL;

-- PostgreSQL can infer this non-partial uniqueness for retry-safe REST upserts.
CREATE UNIQUE INDEX IF NOT EXISTS participation_notifications_pulse_retry_idx ON public.participation_notifications(recipient_user_id,pulse_run_id);
