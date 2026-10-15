# Beat Crate launch readiness — 16 October 2026

## Delivery

Single and bulk creation now share `BeatCrateUploadForm` across web upload, Creator Studio and app BeatStore Studio. Select 1–25 preview files, edit filename-derived titles, apply shared prices/genre/cover, and override individual details. Legacy pack drafts remain available from the older-draft disclosure; the legacy pack bound is also 25.

Details autosave to an owner-scoped private database draft with a version check. Each storage path is checkpointed before transfer. Recovery verifies objects that actually arrived. Completed objects are reused; missing browser files must be selected again. File transfers have progress, timeout, bounded retries and pause. A local metadata backup is scoped to the signed-in user; it contains no audio bytes or credentials.

Finalization locks the draft and serializes this producer's submissions. Beat, pack, licence and receipt writes are one transaction. Retrying a completed submission returns its receipt, including after a lost HTTP response. Identical newly uploaded audio is hashed in the browser and prevented from creating a second beat for that producer. Editorial still checks originality, altered duplicates and quality.

Challenge UI shows approved/pending/needs-attention counts, profile-photo status and a private Instagram handle. Challenge submissions require cover art, a real profile picture, rights confirmation and an Instagram handle. Editorial work items include the handle, approved count and the submission timestamp of the 25th approved beat. Counts include existing approved/published beats, deduplicated by preview path. Legacy beats without `submitted_at` fall back to creation time. Social follow/tag checks and awarding prizes are manual; this change never grants a prize or spends wallet funds.

## Verified locally

- `npm run build`: all repository build gates plus Next production build.
- `npm run typecheck`.
- Targeted ESLint for changed upload/auth modules.
- `npm run test:beat-crate`: actual 25-item SQL transaction, rollback on licence failure, single submission, duplicate hash rejection, ownership, stale version rejection, missing-file rejection, browser-role grants, receipt recovery.
- React flow test: failure on file 24 preserves 23 completed files; retry uploads only 24 and 25; a lost final response is recovered without re-upload or a second submission.

## Activation order

1. Approve and apply `supabase/migrations/20261015211020_beat_crate_launch_readiness.sql` to production project `rdwwyolrxahimcgpkzzy`. Automatic approval review blocked this action in the implementing session; it has NOT been applied.
2. Verify RLS on both new tables and confirm `anon` and `authenticated` have no table access or finalization-function execution. The function is SECURITY INVOKER and service-role-only.
3. Deploy this reviewed commit to Vercel project `bvsradio-saiba` (`prj_jdey5oej8CGAROfdPK2f5frnq2YK`), team `team_HYmWoU6WIW4IHXmh3mrB10Oq`, production domain `bvsradio.com`.
4. On a producer test account, use mobile Safari and desktop: sign in from beat entry, select 25 distinct original audio files, add covers, save Instagram, confirm rights, submit, and verify exactly 25 beats and licences with pending review.
5. Repeat with an interrupted transfer and reload; the completed files must show received, and missing files must request reselection. Verify the editorial handle and approval progress.

Authenticated production upload and real-device network interruption have not been verified because activation is blocked on the migration. No production load-capacity claim is made. If rollout fails, revert the application commit; retain the additive tables and saved drafts rather than deleting producer work.
