# Validation Sprint Tasks

| ID | Task | Owner | Status | Current result / remaining gate |
|---|---|---|---|---|
| S00 | Baseline + recovery point | Saiba | DONE | SHA/deployment/migrations recorded; sprint branch created |
| S01 | Creator + BeatStore funnel analytics | Saiba | CODE DONE · PASSIVE VERIFY | Full funnel instrumented; Editorial 30-day funnel endpoint added; security-gated Vercel build passes. Lyrics Pad browser-event verification is no longer a rollout blocker because usage is expected to be sparse; verify naturally when real beta/web buyer traffic appears. |
| S02 | Song Workspace E2E hardening | Saiba | DONE | Seeded paid-beat path passed: entitlement → Owned → workspace → lyrics save/reopen → ready → release submission with BVS workspace marker. |
| S03 | Entitlement/security verification | Saiba | DONE | Wrong/unpaid order, wrong beat, duplicate workspace, empty token and unauthenticated access all fail closed as designed. Browser PATCH does not accept releaseId. |
| S04 | Mobile Studio friction fixes | Saiba | CORE STUDIO ONLY | Lyrics Pad is accepted for this stage and will be checked naturally on the live website. Spend mobile QA time on the higher-frequency Studio jobs (Release music / Sell a beat / Offer a service); fix only observed friction. |
| S05 | Rotation admissibility inventory | Saiba + BVS | DONE | Production mapped read-only: 65 web / 5 iOS. 26 current-Passport candidates; 1 legacy release; 18 standalone verified-credit; 15 standalone evidence-poor. |
| S06 | Runtime/API smoke QA | Saiba | API/RUNTIME DONE | Canonical beta runtime errors: none in last 24h. Station/web+iOS and auth fail-closed endpoints checked. Real payment rail intentionally not exercised. Mobile/human UX remains under S04. |
| S07 | First iOS candidate batch | Editorial + BVS | EDITORIAL PRIORITY QUEUE | Editorial now chooses which tracks deserve first publication using `EDITORIAL_IOS_PRIORITY.md`. Evidence retrieval happens only for selected tracks with a specific gap. No clearance rows changed. |
| S08 | Beta → prod promotion checklist | Saiba | DONE | Feature-level surface classification, smoke gates, rollback and explicit production-approval rule documented. |
| S09 | Standalone canonical beta deploy | VPS agent | DONE | `bvsradio-beta.vercel.app` deployed from clean detached worktree at `09e6a361...`; guard/preflight/build passed; station remains 1 web / 0 iOS fail-closed. Production not targeted. |
| S10 | Production Candidate 01 — intent-first Studio | Saiba + BVS | READY FOR HUMAN PREVIEW | Isolated from `main`; branch `saiba/prod-candidate-studio-intent-2026-08-28` at `ba9dd2e6...`; 8-file diff, no DB migration, Vercel READY. Requires explicit production approval after preview. |
| S11 | Production Candidate 02 — Lyrics Pad | Saiba + BVS | BUILD READY · NOT APPROVED | Downstream of Candidate 01; branch `saiba/prod-candidate-lyrics-pad-2026-08-28` at `30889df8...`; entitlement regression + TypeScript/build pass. Requires production `song_workspaces` migration and explicit approval before deploy. |
| S12 | iOS clearance operating runbook | Saiba + BVS | DONE | Existing Editorial clearance UI/API retained as source of truth. Human evidence review → beta stage → `surface=ios` smoke → explicit prod approval. No parallel admin feature needed. |
| S13 | Recover evidence for selected priority tracks | M1/VPS agent | ON DEMAND · DEFERRED | Do **not** search all connected Drive/Gmail/archive records just to rank tracks. Editorial selects priority tracks first. If a selected track has a specific missing document/master/authority question, hand only that targeted lookup to the agent with M1/VPS/connected-account access. No automatic clearance or production writes. |

## Product decision — Lyrics Pad

BVS accepts the current Lyrics Pad / Song Workspace implementation as sufficiently tested for this stage. The feature is expected to be low-frequency until more beat purchases occur, so additional synthetic browser QA is not justified before web rollout. Keep analytics enabled and review the experience opportunistically when the next genuine buyer uses it. Do not let sparse Lyrics Pad usage block higher-value Studio/content rollout work.

## Production candidate state

### Candidate 01 — Studio
- branch: `saiba/prod-candidate-studio-intent-2026-08-28`
- head: `ba9dd2e6d5b2dd38d07a686406e5dcd7c9bc211c`
- preview deployment: `dpl_63EYJyDypMctRnV9S6BGQZkEnUrV` — READY
- no production schema migration
- documented in `PROD_CANDIDATE_STUDIO.md`

### Candidate 02 — Lyrics Pad
- branch: `saiba/prod-candidate-lyrics-pad-2026-08-28`
- head: `30889df8d77714a8dcc8e9a89f876781efbf9b76`
- preview deployment: `dpl_AwyS3DB52EW61NYLcHhSyZztDggm` — READY
- `test:song-workspace` runs before Next build and passed
- production schema migration required but **not applied**
- documented in `PROD_CANDIDATE_LYRICS_PAD.md`

Production `main` remains `9b2c7a9dcbda5915ecaf7cf492bf3d0a7b684ca8`.

## Analytics funnel implemented

### Creator Studio
- `studio_open`
- `create_intent_selected` (`release` / `beat` / `service`)
- `create_form_started`
- `create_submission_complete`

### Beat → song → release
- `beat_view` (engaged preview start)
- `licence_selected`
- `checkout_started` (existing)
- `payment_confirmed`
- `lyrics_pad_open`
- `lyrics_first_save`
- `lyrics_return_session`
- `prepare_release`
- `release_submitted`

## Current validated beta code slice
Promoted and deployed to canonical beta:
- SHA: `09e6a361a16a0c362a11b25205c114b7a12bd3ea`
- Canonical alias: `https://bvsradio-beta.vercel.app`
- `test:song-workspace` executes before Vercel `next build` and passes.

## Seeded buyer E2E summary
- Beta-only seed order used; no production payment rail or production data.
- Paid entitlement recognized.
- Owned Library returned the purchased beat.
- Song Workspace creation was idempotent.
- Lyrics persisted after reopen.
- `ready_to_release` transition passed.
- Release submission carried the `BVS_SONG_WORKSPACE:<workspace-id>` marker into Rights Passport evidence.
- Wrong/unpaid order and wrong beat returned 403.
- Unauthenticated/empty-token access returned 401.
- Initial text/plain evidence probe was rejected as expected; image evidence retry passed.

## Content operations
- `IOS_RIGHTS_EVIDENCE_GATE.md` contains the detailed current-five and expansion evidence review.
- `EDITORIAL_IOS_PRIORITY.md` is now the operational shortlist for deciding which tracks Editorial reviews/publishes first.
- `IOS_CLEARANCE_RUNBOOK.md` locks the operating procedure around the existing Editorial clearance controls.
- M1/VPS evidence recovery is now on-demand only after Editorial selects a priority track with a concrete evidence gap.
- No production mobile clearance row was changed during this sprint.

## Handoff rule
Every implementation task must record branch/SHA, files changed, migrations, test result, known issues and rollback point before production promotion.
