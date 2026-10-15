# BVS Signal: trusted song journeys

## What is authoritative

- **Catch:** an authenticated member's deliberate discovery receipt, not listening
  proof, a vote, or an entitlement. One track × member. Source is attribution only.
- **Selected:** a saved editorial reason. Publishing alone means "On BVS".
- **First Spin announcement:** editorial intent only. This desk does not control
  the broadcaster's queue. When its time passes without proof, it stays pending.
- **First Spin aired:** the earliest acknowledged media start in
  `track_broadcast_events`. No legacy browser telemetry is copied into this ledger.
- **Rotation:** the existing editorial rotation flag; it does not imply broadcast.
- **Gaining Signal:** in rotation, previously broadcast, at least 5 Catches in the
  last rolling 7 days and more than the previous 7 days. The panel explains this.
  It is descriptive activity, never a rotation command or automatic Breakout.
- **Breakout:** a deliberate editorial award after a saved reason and verified
  First Spin. Award/removal and every editorial change are audited transactionally.

A prior First Spin remains visible in the dated journey after rotation removal.
The main badge describes the current chapter, not a fabricated linear rank.

## Receipt integrity and privacy

The database serializes new Catches on the track row and increments a persistent
per-track counter. Retries preserve the receipt and timestamp. Deleting a member
removes their personal row but does not renumber other receipts or reuse numbers.
Consequently, receipt numbers can exceed the current visible Catch count.

Legacy Catches receive deterministic ordinals once, ordered by timestamp then ID.
Previous timestamp-count positions were not stored guarantees; do not describe
those old inferred positions as immutable historical numbers.

The public response contains aggregate counts and only the requesting member's
receipt. All RPCs/tables/views are denied to browser roles; application routes
verify identity and editorial permissions. Anonymous Supabase accounts cannot
Catch. Authenticated reads are private/no-store.

## Deployment order

1. Apply existing editorial/final-sprint schemas and `supabase-bvs-signal.sql`.
2. Apply `supabase/migrations/20261015074532_bvs_signal_trusted_journey.sql`.
   This is additive except for replacing the old browser-derived First Spin view.
   Existing config/Catches remain; legacy First Spin claims intentionally disappear.
3. Deploy this PR. Old application versions cannot insert receipts without ordinals;
   use a maintenance window or pause Catch during the migration/deploy boundary.
4. Smoke-test approved/public gating, duplicate Catch, editorial conflict handling,
   and missing-proof presentation before exposing the feature to users.

The migration was behavior-tested in embedded PostgreSQL with fixture roles and
schemas. That does not mean it has been applied to beta/production or that a real
station broadcast has been verified. Run project-specific advisors and staging
checks before production migration. Code rollback alone is not schema rollback:
the older application expects the former Catch insert shape.

## Connect the real broadcaster — required activation step

This repository has browser-managed rotation, not the server playout process.
The endpoint and reporter are implemented here; they are NOT evidence that a
broadcaster is connected.

Configure separate, server-only secrets per environment:

- `BVS_PLAYOUT_STATION_ID`: one explicitly allowed broadcaster identity.
- `BVS_PLAYOUT_SIGNING_SECRET`: at least 32 randomly generated characters,
  shared only by that broadcaster and the BVS ingress. Never NEXT_PUBLIC.
- Existing Supabase server credentials remain server-only.

Wire `ops/playout/signal-reporter.mjs:reportSignalStarted` into the existing
playout/encoder's **actual track media-start acknowledgement**, after mapping its
broadcast asset to the BVS track UUID. OBS/SRS stream availability by itself does
not identify which track aired. Do not replace that mapping with a scheduler tick.

The broadcaster must durably enqueue an acknowledgement with:

- stable `eventId` unique to that airing, retained across retries;
- BVS `trackId`;
- original UTC `startedAt` from actual media start.

The reporter adds configured station identity and signs the exact JSON bytes using
HMAC-SHA256 over `timestamp-in-milliseconds + "." + body`.
The request headers are `x-bvs-timestamp` and `x-bvs-signature` (lowercase hex).
The signature is valid for five minutes; sign retries afresh but keep the event ID
and original start time. Retries with identical event data are idempotent.
Reusing an ID for different playback returns 409 and needs investigation.
Automatic retry is appropriate for network errors, 429 and 5xx; retain failed
events in the broadcaster's outbox. 4xx validation/identity errors need operator
attention. Events more than seven days old or over five seconds in the future
are rejected; reconcile extended outages explicitly rather than silently backdating.

Without valid configuration the ingress returns 503. Without a valid signature,
correct station identity and acceptable event time it cannot write proof.
No public/manual endpoint exists to award First Spin.

Activation acceptance: broadcast a real approved track with ZERO browser listeners,
observe its exact ledger event and First Spin, then replay the same acknowledgement
and verify no duplicate. An announcement-only track must remain pending.
Do not report this activation check as passed until the actual broadcaster runs it.

## Verification

`node scripts/bvs-signal-tests.mjs` executes real PostgreSQL functions/ACLs, API
handlers, signature validation and React hooks. PGlite serializes connection
requests; the competing-revision/retry tests do not substitute for a multi-session
load test against staging Postgres. CI also runs type checking, the build and
the existing regression gates.
