-- BVS participation performance hardening.
-- Cover foreign-key paths used by delete/fanout/moderation work and avoid
-- per-row auth.uid() evaluation in account-scoped RLS policies.

CREATE INDEX IF NOT EXISTS participation_threads_object_owner_idx
  ON public.participation_threads(object_owner_user_id)
  WHERE object_owner_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS participation_messages_reply_to_idx
  ON public.participation_messages(reply_to_id)
  WHERE reply_to_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS participation_thread_subscriptions_thread_idx
  ON public.participation_thread_subscriptions(thread_id);

CREATE INDEX IF NOT EXISTS participation_reports_thread_idx
  ON public.participation_reports(thread_id)
  WHERE thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS participation_reports_message_idx
  ON public.participation_reports(message_id)
  WHERE message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS participation_reports_reported_user_idx
  ON public.participation_reports(reported_user_id)
  WHERE reported_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS participation_reports_review_owner_idx
  ON public.participation_reports(review_owner_user_id)
  WHERE review_owner_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS participation_moderation_audit_staff_idx
  ON public.participation_moderation_audit(staff_user_id);
CREATE INDEX IF NOT EXISTS participation_moderation_audit_thread_idx
  ON public.participation_moderation_audit(thread_id)
  WHERE thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS participation_moderation_audit_message_idx
  ON public.participation_moderation_audit(message_id)
  WHERE message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS participation_moderation_audit_report_idx
  ON public.participation_moderation_audit(report_id)
  WHERE report_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS participation_domain_events_actor_idx
  ON public.participation_domain_events(actor_user_id)
  WHERE actor_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS participation_domain_events_thread_idx
  ON public.participation_domain_events(thread_id)
  WHERE thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS participation_domain_events_message_idx
  ON public.participation_domain_events(message_id)
  WHERE message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS participation_notifications_event_idx
  ON public.participation_notifications(event_id)
  WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS participation_notifications_thread_idx
  ON public.participation_notifications(thread_id)
  WHERE thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS participation_notifications_message_idx
  ON public.participation_notifications(message_id)
  WHERE message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS participation_notifications_pulse_idx
  ON public.participation_notifications(pulse_run_id)
  WHERE pulse_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS participation_deliveries_notification_idx
  ON public.participation_deliveries(notification_id)
  WHERE notification_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS participation_deliveries_pulse_idx
  ON public.participation_deliveries(pulse_run_id)
  WHERE pulse_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS participation_deliveries_recipient_idx
  ON public.participation_deliveries(recipient_user_id)
  WHERE recipient_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS participation_pulse_runs_recipient_idx
  ON public.participation_pulse_runs(recipient_user_id)
  WHERE recipient_user_id IS NOT NULL;

DROP POLICY IF EXISTS "Users read own thread subscriptions" ON public.participation_thread_subscriptions;
CREATE POLICY "Users read own thread subscriptions" ON public.participation_thread_subscriptions
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users read own rule agreements" ON public.participation_rule_agreements;
CREATE POLICY "Users read own rule agreements" ON public.participation_rule_agreements
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users read own blocks" ON public.participation_blocks;
CREATE POLICY "Users read own blocks" ON public.participation_blocks
  FOR SELECT USING ((SELECT auth.uid()) = blocker_user_id);

DROP POLICY IF EXISTS "Users read own reports" ON public.participation_reports;
CREATE POLICY "Users read own reports" ON public.participation_reports
  FOR SELECT USING ((SELECT auth.uid()) = reporter_user_id);

DROP POLICY IF EXISTS "Users read own participation notifications" ON public.participation_notifications;
CREATE POLICY "Users read own participation notifications" ON public.participation_notifications
  FOR SELECT USING ((SELECT auth.uid()) = recipient_user_id);

DROP POLICY IF EXISTS "Users read own participation preferences" ON public.participation_preferences;
CREATE POLICY "Users read own participation preferences" ON public.participation_preferences
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users read own digest runs" ON public.participation_pulse_runs;
CREATE POLICY "Users read own digest runs" ON public.participation_pulse_runs
  FOR SELECT USING ((SELECT auth.uid()) = recipient_user_id AND run_type = 'user_digest');
