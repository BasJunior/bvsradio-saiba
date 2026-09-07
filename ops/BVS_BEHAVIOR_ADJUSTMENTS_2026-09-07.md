# BVS behavior adjustment plan — 2026-09-07

Status: preparation only. No production deployment, email send, destructive action, or production data write is authorized by this document.

## What current production behavior says

- Artist accounts: 98.
- Artists with zero tracks: 59.
- Mature 7-day artist activation: 24 / 71 = 33.8%.
- 22 / 24 activated artists acted within the first hour; median time to first track ~9.8 minutes.
- Editorial SLA is not the bottleneck: 95.5% of reviewed tracks were handled within 48h, median review time ~0.1h.
- Listener behavior is shallow relative to signup: recent listener cohort shows 50 confirmed accounts, 16 with synced listening history, 3 saving music, 6 following a creator.
- External listening is real but small: ~2,074 external player starts across ~445 external start sessions in the last 30d.
- Catalogue discovery is broad: 82 tracks received recent plays; top 10 accounted for ~27.6% of recorded recent plays.
- Playback reliability is the largest quality signal: ~33.1% of playback-start sessions also logged a media/start/track-change playback error.
- Acquisition collapsed after 2026-08-30: 63 profiles were created Aug 25–29, then only 1 new profile Aug 31–Sep 7.
- Commerce is not yet the core loop: 6 orders created / 1 paid ($9) in 30d, 3 active memberships, 0 marketplace bookings, 0 creator-service orders.

## Release train

### P0 — Playback reliability and observability

Goal: make Play trustworthy before adding more listener surface area.

Primary code:
- `src/components/StationPlayer.tsx`
- `src/lib/analytics.ts`
- `src/app/api/analytics/route.ts`
- station/media URL serving code as indicated by failure-host analysis

Current baseline notes:
- production already logs richer media error properties than vNext (`media_error_code`, source host, network state).
- vNext must inherit those diagnostics rather than replacing production with the older telemetry.

Implementation intent:
1. Preserve the distinction between `start`, `track_change`, and `media` failures.
2. Add a play-attempt identifier so repeated events can be grouped into one failed attempt rather than overcounted.
3. Record platform/surface (`web`, `ios`, `android`) instead of writing `source = web` for every analytics event.
4. Record whether automatic recovery succeeded.
5. Add one bounded automatic retry for transient start/track-change failures before skipping or surfacing an error.
6. Never loop indefinitely; keep the existing fail-streak circuit breaker.
7. Use actual media error/network information to identify failing hosts or formats before changing storage/CDN architecture.

Acceptance:
- media/start/track-change error-affected playback sessions < 10% first, then target < 5%.
- no increase in repeated skip loops.
- player starts and qualified 30s streams can be compared by platform.
- no regression in queue, offline, background/native or station auto-advance flows.

### P1 — Acquisition and retention attribution

Goal: make the next traffic spike explainable and measure real return behavior.

Primary code:
- `src/lib/analytics.ts`
- `src/app/api/analytics/route.ts`
- `src/app/api/auth/signup/route.ts`
- web signup client/page
- vNext signup client/page

Implementation intent:
1. Capture privacy-safe first-touch attribution from standard query params (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `ref`) with strict length/character limits.
2. Persist first-touch attribution with signup in non-sensitive metadata or a dedicated attribution record; do not persist full referrer URLs containing arbitrary query data.
3. Add a long-lived random pseudonymous visitor id for analytics only when analytics is allowed; keep current per-session id separately.
4. Do not fingerprint users and do not store IP/user-agent as identity.
5. Add lifecycle events: `signup_started`, `signup_completed`, `first_listen`, `first_qualified_listen`, `first_save`, `first_follow`, `return_session`.
6. Distinguish app surface from web in analytics.

Acceptance:
- future registrations can be grouped by source/campaign.
- D1/D7 listener return can be calculated without using email or personally identifying fields.
- account confirmation vs first listen vs first save/follow are separately measurable.

### P2 — Artist first-action recovery

Goal: recover the 59 artists who joined but never submitted a track.

Primary code/concepts:
- existing vNext Studio next-action state machine
- beta D11 artist reactivation email/cohort implementation as reference
- Creator Studio first-upload anchor/deep link

Implementation intent:
1. Keep free-first path: Submit → BVS review → Live on BVS → Rotation → optional distribution.
2. Do not put Premium in front of first BVS activation.
3. Prepare one 10–15 artist primary cohort only: Artist role + zero tracks.
4. Attribute reactivation link visits and actual upload form starts/completions.
5. Do not send any email until explicit outbound-send authorization is given.
6. Do not broaden to secondary live-artist or review cohorts until primary experiment is measured.

Acceptance:
- 10–15-person cohort can be dry-run with candidate count and no exposed emails.
- target: >=3 first submissions from the first controlled cohort.
- funnel: sent → Studio visit → actual upload start → upload complete → live.

### P3 — Listener habit loop

Goal: move BVS from open/listen/leave toward personal investment and return.

Primary surfaces:
- Home / Listen
- Discover
- Library
- Now Playing
- artist profiles

Implementation intent:
1. First successful listen should expose one clear next habit action, not multiple competing CTAs.
2. Prioritize favourite/save and follow over commerce prompts.
3. Use Recently Played as a return surface.
4. After a save/follow, make the Library change immediately visible.
5. Avoid Premium/Marketplace interruption before the user has demonstrated repeat listening intent.

Acceptance:
- increase % of newly confirmed listeners who create listening history.
- increase first-7d save and follow rates.
- measure D1 and D7 return after first qualified listen.

### P4 — Search/entity matching

Goal: stop losing high-intent users who type a creator/title BVS already knows.

Primary code:
- `src/app/search/page.tsx`
- artist/producer/catalogue APIs feeding search

Implementation intent:
1. Normalize punctuation/case/spacing and support token-prefix matching.
2. Search usernames, public artist names, display names, track artist names and aliases where available.
3. Rank exact creator/title matches above generic tag/content matches.
4. Keep no-result analytics, but add result count and selected entity kind for successful searches.
5. Avoid fuzzy matches so broad that unrelated creators become top results.

Acceptance:
- recurring known-entity no-result queries resolve when the entity is actually published/searchable.
- search-to-play and search-to-creator conversion can be measured.

## Explicit non-priorities for this train

- large new Marketplace feature work
- Premium redesign/hard-sell
- faster editorial tooling purely for SLA
- new social/community surface
- distributor exposure to artists
- production auth-shell changes unless separately approved

## Promotion gates

1. Implement on `saiba/app-vnext-2026-09` or a child implementation branch first.
2. Typecheck/build/safe-floor tests green.
3. iOS and Android native contracts/compiles green for shared player/analytics changes.
4. Verify analytics payload cardinality and privacy limits.
5. Compare exact production diff before promotion.
6. No production promotion without explicit instruction.
7. No outbound artist email without explicit send authorization.

## Current refs when plan was locked

- vNext branch head before this plan: `e6ad94142a4984adf8b0c87e25a7cdae33a723f0`.
- production/current: `2bfc1d21a37aaa0d2dd604ddf3dce52a5cce8f31`.
