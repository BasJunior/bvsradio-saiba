# Notification orchestration — 12 October 2026

## Status: foundation, shadow only; not the completed personalization upgrade

Source baseline: live main `2c4bbdda8d71784c1c41e7a6cf367d7813efddd3`, verified through Vercel inspect and deployment metadata. Worktree is isolated from foreign VPS/Mac work. Existing badge build 17 and its deferred owner-device verification are unchanged.

Implemented:

- Deterministic, explainable relevance ranking with consent, expiry, seen/completed, exact destination, active-target, duplicate, quiet-hours, 24h/7d cap, cooldown and media-signal gates before scoring.
- Creator/transactional priority and marketing-cap bypass in the policy, never consent bypass. One next-best candidate per batch; other items stay inbox/deferred.
- Per-account first-party motivation counters, durable deduplicated notification interactions and shadow decisions. These are server-only RLS tables and narrowly granted service-role functions.
- Existing community notification adapter reads durable consent, enabled devices, eligibility, recent contacts and opens. Multiple device sends count as one logical contact using the latest send time. Unopened does not mean OS-delivered or intentionally ignored.
- Authenticated analytics updates known motivation counters only. No fingerprints, ringer data or arbitrary user-supplied affinity values.
- iOS build 17 forwards only href. Future APNs links carry `bvs_notice`; runtime extracts/strips it before routing while preserving existing query/hash. No new binary needed for this compatibility path. Already-sent pushes lack IDs and cannot be retroactively attributed.
- Bounded in-memory interaction retries wait for login and retry on resume/connectivity/30-second interval. Account changes clear pending entries. No delivery or destination-loaded claims inferred from a tap.
- Enabling system push permission no longer silently enables community consent.

## Activation and isolation

`BVS_NOTIFICATION_ORCHESTRATION=shadow` enables the data collection and evaluator. Any other value disables them. There is intentionally **no enforcement mode**, no new sending adapter and no automatic cron schedule in this change. Existing community delivery remains unchanged.

`GET /api/cron/notification-shadow` requires the canonical worker project and CRON_SECRET. It audits a bounded recent sample (50 candidates, at most 5 accounts), not the entire catalogue. Decisions are latest evaluations, not an immutable experiment history or analytics dashboard. The evaluator runs separately so it cannot consume the existing push worker's time budget.

SQL pack `notification-orchestration` was applied to verified live project `rdwwyolrxahimcgpkzzy`; browser client bundle confirmed that project. No unrelated stale packs were reapplied. Test writes use a rollback-only transaction. Applying schema alone does not activate tracking or send anything.

## Deliberately outstanding

This is not the full requested product. Remaining work includes:

- General durable creator/order/marketplace notification objects and bounded migration with no historical replay; operations currently retain their existing snapshot inbox source.
- Atomic outbox writers for status transitions and exact submission/order/booking/player destinations across surfaces.
- Followed artist releases, backend OBS/SRS-confirmed live events, upcoming shows, relevant discovery and meaningful milestone candidate producers. The policy's live gate is tested, but no new live candidate producer is enabled.
- Unified cross-platform operational seen/read state and badge counts; current durable community badge remains intact.
- Granular preference UI/storage and contextual permission prompts. Existing off switches are preserved; policy supports the expanded categories, but the new controls are not exposed yet.
- Authenticated current-target presence, recent/decaying artist-specific affinities and session/retention features. Current counters are a small first-party foundation, not a calibrated engagement model.
- Real destination-loaded/action-completed instrumentation. Schema reserves these events, but the public interaction endpoint currently accepts only opens/deeplink opens.
- Atomic contact reservations and per-user arbitration across concurrent workers before any live enforcement; do not activate a sender using a read-only cap check.
- Stable holdout assignment, historical exposure records, conversion/retention dashboard, quiet-time scheduling and all-channel fatigue accounting.
- Signed-in staged browser verification, then controlled delivery verification. Owner retains physical-device checks.

## Verification

- Behavioral policy tests: hard gates, exact links, confirmed/stale live evidence, creator priority, fatigue, caps, per-device dedupe and conservative preferences.
- Adapter tests: disabled mode touches no storage, shadow writes only decisions, durable community opt-out and truthful storage failure.
- Link/queue tests: href-only build17 attribution, preserved anchor/query, malformed ID rejection, cold-login wait, retry, success removal and account clear.
- Existing notification reliability and badge regressions pass.
- Rollback-only real database tests pass: table RLS/grants, RPC grants, recipient ownership, duplicate retry and atomic counters.
