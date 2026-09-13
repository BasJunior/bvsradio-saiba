-- BVS participation security hardening.
-- Keep every SECURITY DEFINER mutation/read-state RPC behind the trusted server.
-- The app calls these through service-role authenticated API routes, never directly.

REVOKE ALL ON FUNCTION public.consume_participation_rate_limit(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_participation_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.create_participation_post(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_participation_post(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID[]) TO service_role;

REVOKE ALL ON FUNCTION public.create_participation_reply(UUID, UUID, UUID, TEXT, TEXT, UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_participation_reply(UUID, UUID, UUID, TEXT, TEXT, UUID[]) TO service_role;

REVOKE ALL ON FUNCTION public.ensure_participation_content_thread(TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_participation_content_thread(TEXT, TEXT, TEXT, TEXT, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.set_participation_reaction(UUID, UUID, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_participation_reaction(UUID, UUID, TEXT, BOOLEAN) TO service_role;

REVOKE ALL ON FUNCTION public.mark_participation_notifications_read(UUID, UUID[], TIMESTAMPTZ, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_participation_notifications_read(UUID, UUID[], TIMESTAMPTZ, BOOLEAN) TO service_role;

-- Summary is also server-mediated so a client cannot pass another user's UUID as p_viewer.
REVOKE ALL ON FUNCTION public.participation_thread_summary(UUID[], UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.participation_thread_summary(UUID[], UUID) TO service_role;
