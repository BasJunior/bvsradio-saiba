# Validation Sprint Tasks

| ID | Task | Owner | Status | Current result / remaining gate |
|---|---|---|---|---|
| S00 | Baseline + recovery point | Saiba | DONE | SHA/deployment/migrations recorded; sprint branch created |
| S01 | Creator + BeatStore funnel analytics | Saiba | CODE DONE · VERIFY BROWSER | Full funnel instrumented; Editorial 30-day funnel endpoint added; security-gated Vercel build passes. Seeded E2E was API-driven, so browser event arrival still needs a real beta browser session. |
| S02 | Song Workspace E2E hardening | Saiba | DONE | Seeded paid-beat path passed: entitlement → Owned → workspace → lyrics save/reopen → ready → release submission with BVS workspace marker. |
| S03 | Entitlement/security verification | Saiba | DONE | Wrong/unpaid order, wrong beat, duplicate workspace, empty token and unauthenticated access all fail closed as designed. Browser PATCH does not accept releaseId. |
| S04 | Mobile Studio friction fixes | Saiba | NEXT | Run real-phone/browser task tests against intent-first Studio and Lyrics Pad; fix only observed friction. |
| S05 | Rotation admissibility inventory | Saiba + BVS | DONE | Production mapped read-only: 65 web / 5 iOS. 26 current-Passport candidates; 1 legacy release; 18 standalone verified-credit; 15 standalone evidence-poor. |
| S06 | Runtime/API smoke QA | Saiba | API/RUNTIME DONE | Canonical beta runtime errors: none in last 24h. Station/web+iOS and auth fail-closed endpoints checked. Real payment rail intentionally not exercised. Mobile/human UX remains under S04. |
| S07 | First iOS candidate batch | Saiba + BVS | READY FOR HUMAN RIGHTS REVIEW | 5-track review batch proposed from Whisper II Drive + FRESHMAN MUSIK. Existing Heavy/Jegera/Thugging evidence-pack gaps identified first. No clearance rows changed. |
| S08 | Beta → prod promotion checklist | Saiba | DONE | Feature-level surface classification, smoke gates, rollback and explicit production-approval rule documented. |
| S09 | Standalone canonical beta deploy | VPS agent | DONE | `bvsradio-beta.vercel.app` deployed from clean detached worktree at `09e6a361...`; guard/preflight/build passed; station remains 1 web / 0 iOS fail-closed. Production not targeted. |

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
