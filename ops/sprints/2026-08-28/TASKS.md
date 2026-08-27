# Validation Sprint Tasks

| ID | Task | Owner | Status | Current result / remaining gate |
|---|---|---|---|---|
| S00 | Baseline + recovery point | Saiba | DONE | SHA/deployment/migrations recorded; sprint branch created |
| S01 | Creator + BeatStore funnel analytics | Saiba | CODE DONE | Full funnel instrumented; Editorial 30-day funnel endpoint added; security-gated Vercel build passes. Needs real beta traffic to validate counts. |
| S02 | Song Workspace E2E hardening | Saiba | PARTIAL | Source/build/API/DB path hardened. Full signed-in buyer E2E needs the seeded beta demo password/session or a real beta tester. |
| S03 | Entitlement/security verification | Saiba | PASS + ONE MANUAL GATE | DB has SELECT-own only, unique buyer/order/beat constraint and verified trigger. Deployed unauthenticated Workspace/Owned routes return 401. Cross-account signed-in attempt remains manual E2E. |
| S04 | Mobile Studio friction fixes | Saiba | WAITING FOR USER TEST | No speculative redesign. Next fixes should come from observed phone friction on the current intent-first Studio/Lyrics Pad. |
| S05 | Rotation admissibility inventory | Saiba + BVS | DONE | Production mapped read-only: 65 web / 5 iOS. 26 current-Passport candidates; 1 legacy release; 18 standalone verified-credit; 15 standalone evidence-poor. |
| S06 | Runtime/API smoke QA | Saiba | IN PROGRESS | Canonical beta runtime errors: none in last 24h. Station/web+iOS and auth fail-closed endpoints checked. No live/test payment transaction intentionally triggered. |
| S07 | First iOS candidate batch | Saiba + BVS | READY FOR HUMAN REVIEW | 5-track review batch proposed from Whisper II Drive + FRESHMAN MUSIK. Existing Heavy/Jegera/Thugging evidence-pack gaps identified first. No clearance rows changed. |
| S08 | Beta → prod promotion checklist | Saiba | DONE | Feature-level surface classification, smoke gates, rollback and explicit production-approval rule documented. |
| S09 | Standalone canonical beta deploy | VPS agent | READY FOR HANDOFF | Guarded isolated-worktree procedure written in `VPS_BETA_DEPLOY_HANDOFF.md`; expected deploy SHA `09e6a361...`. |

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
Promoted to active beta Git branch:
- SHA: `09e6a361a16a0c362a11b25205c114b7a12bd3ea`
- Sprint preview build: `dpl_FLpXVNGH2zNEMFi7yHvFwLKvqcgg` — READY
- `test:song-workspace` executes before Vercel `next build` and passes.

The canonical standalone `bvsradio-beta.vercel.app` still requires the guarded VPS CLI deployment in S09; do not confuse the Git branch preview with the standalone beta alias.

## Handoff rule
Every implementation task must record branch/SHA, files changed, migrations, test result, known issues and rollback point before production promotion.