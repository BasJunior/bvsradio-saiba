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
| S07 | First iOS candidate batch | Saiba + BVS | READY FOR HUMAN RIGHTS REVIEW | 5-track review batch proposed from Whisper II Drive + FRESHMAN MUSIK. Existing Heavy/Jegera/Thugging evidence-pack gaps identified first. No clearance rows changed. |
| S08 | Beta → prod promotion checklist | Saiba | DONE | Feature-level surface classification, smoke gates, rollback and explicit production-approval rule documented. |
| S09 | Standalone canonical beta deploy | VPS agent | DONE | `bvsradio-beta.vercel.app` deployed from clean detached worktree at `09e6a361...`; guard/preflight/build passed; station remains 1 web / 0 iOS fail-closed. Production not targeted. |

## Product decision — Lyrics Pad

BVS accepts the current Lyrics Pad / Song Workspace implementation as sufficiently tested for this stage. The feature is expected to be low-frequency until more beat purchases occur, so additional synthetic browser QA is not justified before web rollout. Keep analytics enabled and review the experience opportunistically when the next genuine buyer uses it. Do not let sparse Lyrics Pad usage block higher-value Studio/content rollout work.

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

## Current validated code slice
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

## Handoff rule
Every implementation task must record branch/SHA, files changed, migrations, test result, known issues and rollback point before production promotion.
