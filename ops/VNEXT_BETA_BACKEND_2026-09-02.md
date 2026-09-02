# vNext beta backend authorization and verification

User authorization: “use beta backend and adjust where necessary”. This supersedes the previous requirement for a separate new vNext database. Production remains prohibited; the existing beta deployment/alias is not replaced.

## Applied only to beta

- Supabase project: `bvsradio-beta`, reference `kuqdhuomcqonhnwfgrlw`.
- Migration: `bvs_vnext_beta_native_prerequisites_20260902`.
- SQL sources: `supabase-app-vnext.sql` and `supabase-app-vnext-2026-09.sql` at this commit.
- Added `community_blocks`, `app_push_devices`, `app_notification_preferences`, associated indexes and access policies.
- Added owner/public-read playlist policies without granting new direct client access. Existing beta playlist routes are server-mediated.
- Existing `live_chat_messages.room_id` already existed; no messages needed backfill.
- No rights clearances, accounts, media records, storage objects, payment settings or production data changed.

The new tables use RLS and explicit service-mediated access. Public/anon/authenticated direct privileges are revoked; service-role DML is granted. Push tokens and notification preferences are not publicly readable.

## Verification

- Schema and grant inspection: PASS. RLS enabled for all five affected tables. Anon/authenticated SELECT denied; service-role DML available.
- Rolled-back transaction using existing beta accounts: PASS for playlist creation/rename/removal, preferences upsert, push-device insert and block insert/read. No test records were retained.
- Data counts before/after: playlists 0, playlist tracks 0, live messages 2, all three new tables 0.
- Security advisor: no ERROR findings. Two new INFO notices are expected for server-only push/preferences tables with RLS but no client policies; grants explicitly deny client access. Do not add public policies merely to suppress these notices.
- See Supabase's [RLS/no-policy advisory](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) for the distinction between intentional default-deny and missing application access.

These are database contract checks, not end-to-end authenticated device acceptance.

## Deployment configuration: blocked on secure service key

Vercel source project `bvsradio-beta` holds the deployed beta backend values. Destination is **only** project `bvsradio-saiba`, environment `preview`, Git branch `saiba/app-vnext-2026-09`.

No destination variables were changed in this checkpoint. Read-only inspection found no branch overrides and empty effective Supabase settings in the current vNext preview. The existing public beta URL is not the vNext web product and must not replace the vNext entry route.

An attempted full beta environment export was blocked by the safety reviewer because it could include unrelated storage/payment/webhook secrets. It was not executed or bypassed. The safer metadata-only inspection used the official Vercel API through its normally authenticated CLI, without exposing values.

`scripts/vnext-beta-backend-config.mjs` restricts any eventual transfer to:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

It validates the beta project reference and JWT roles before writing anything, restricts writes to the named vNext preview branch, and suppresses secret-bearing output. Audit mode succeeded. The service-role source variable is **sensitive/non-readable**; do not run a broader pull, scrape logs, rotate it, or substitute a production key.

**Secure handoff needed:** Abias must provide the authoritative beta service-role key through a private local environment file, or enter it directly into the destination Vercel preview variable scoped to this exact branch. Do not paste it in chat. If entering directly, the transfer script must first be adjusted to preserve that manually entered value and transfer only the remaining public settings.

After all three values are securely configured, set the staging lane/site identity for vNext, rebuild the preview, verify its backend identity, and resume native runtime/device work. Storage/offline configuration needs its own narrow beta-only check; no unrelated credentials have been copied.

## Recovery / rollback

Before commit, the migration ran transactionally with short lock/statement timeouts. After success, the safest operational rollback is to stop vNext use and leave the additive empty tables/policies in place. Existing beta uses the same unchanged data and server privileges. Do not drop tables or disable RLS as an automatic rollback; preserve any new data and obtain review before a destructive schema rollback.

## Boundaries

- Production database/web: unchanged.
- Current beta web deployment/alias: unchanged.
- Beta database: only the documented authorized additive migration.
- App Store Connect/archive/TestFlight: no action.
- Native device/product acceptance: still outstanding; this backend checkpoint is not release approval.
