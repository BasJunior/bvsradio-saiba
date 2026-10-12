#!/usr/bin/env python3
"""Explicit DB-backed transactional regression; rolls all test writes back."""
import importlib.util
from pathlib import Path
spec = importlib.util.spec_from_file_location('packs', Path(__file__).with_name('apply-supabase-packs.py'))
packs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packs)
packs.hydrate_env()
conn = packs.connect()
assert conn, 'Database URL required'
try:
    with conn.cursor() as cur:
        sql = (packs.ROOT / 'supabase-notification-orchestration.sql').read_text()
        cur.execute(sql.replace('BEGIN;\n', '', 1).removesuffix('COMMIT;\n'))
        for table in ['notification_engagement_profiles','notification_interactions','notification_decisions']:
            cur.execute("SELECT relrowsecurity FROM pg_class WHERE oid=%s::regclass", ('public.'+table,))
            assert cur.fetchone()[0], 'RLS required'
            for role in ['anon','authenticated']:
                cur.execute("SELECT has_table_privilege(%s,%s,'SELECT,INSERT,UPDATE,DELETE')", (role, 'public.'+table))
                assert not cur.fetchone()[0], 'Client table access denied'
        for fn in ['record_notification_activity(uuid,text,text)','record_notification_interaction(uuid,uuid,text)']:
            for role in ['anon','authenticated']:
                cur.execute("SELECT has_function_privilege(%s,%s,'EXECUTE')", (role, 'public.'+fn))
                assert not cur.fetchone()[0], 'Client RPC access denied'
        cur.execute('SELECT id,recipient_user_id FROM public.participation_notifications LIMIT 1')
        row = cur.fetchone()
        assert row, 'Need one existing notification for rollback-only ownership test'
        notification, owner = row
        cur.execute('SELECT id FROM auth.users WHERE id<>%s LIMIT 1', (owner,))
        other = cur.fetchone()[0]
        cur.execute('SET LOCAL ROLE service_role')
        cur.execute("SELECT public.record_notification_interaction(%s,%s,'notification_opened')", (other,notification))
        assert cur.fetchone()[0] is False, 'Cross-account interaction must fail'
        for _ in range(2):
            cur.execute("SELECT public.record_notification_interaction(%s,%s,'notification_opened')", (owner,notification))
            assert cur.fetchone()[0] is True
        cur.execute("SELECT count(*) FROM public.notification_interactions WHERE user_id=%s AND notification_id=%s AND event='notification_opened'", (owner,notification))
        assert cur.fetchone()[0] == 1, 'Interaction retries must be idempotent'
        for _ in range(2):
            cur.execute("SELECT public.record_notification_activity(%s,'community',NULL)", (owner,))
        cur.execute("SELECT (motivation_counts->>'community')::int FROM public.notification_engagement_profiles WHERE user_id=%s", (owner,))
        assert cur.fetchone()[0] >= 2
    print('Database rollback checks passed: RLS, grants, ownership, idempotence, atomic activity.')
finally:
    conn.rollback()
    conn.close()
