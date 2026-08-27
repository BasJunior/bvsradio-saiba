# Validation Sprint Tasks

| ID | Task | Owner | Status | Acceptance |
|---|---|---|---|---|
| S00 | Baseline + recovery point | Saiba | DONE | SHA/deployment/migrations recorded; sprint branch created |
| S01 | Creator + BeatStore funnel analytics | Saiba | IN_PROGRESS | Events fire once with non-sensitive IDs/intent metadata; build passes |
| S02 | Song Workspace E2E hardening | Saiba | TODO | Paid buyer path works; duplicate/tamper/auth edge cases covered |
| S03 | Entitlement/security verification | Saiba | TODO | Wrong user/unpaid/tampered/direct-DB cases fail closed |
| S04 | Mobile Studio friction fixes | Saiba | TODO | Only evidence-backed usability fixes; no feature sprawl |
| S05 | Rotation admissibility inventory | Saiba + BVS | TODO | Web/iOS/evidence status for current rotation |
| S06 | Runtime/API smoke QA | Saiba | TODO | Studio, song-workspace, orders, storage, payments checked on beta |
| S07 | First iOS candidate batch | Saiba + BVS | TODO | 5–10 strongest candidates + evidence gaps; no auto-clear |
| S08 | Beta → prod promotion checklist | Saiba | TODO | Feature-level checklist with surface classification + rollback |

## Analytics funnel target

### Creator Studio
- `studio_open`
- `create_intent_selected` (`release` / `beat` / `service`)
- `create_form_started`
- `create_submission_complete`

### Beat → song → release
- `beat_view`
- `licence_selected`
- `checkout_started`
- `payment_confirmed`
- `lyrics_pad_open`
- `lyrics_first_save`
- `lyrics_return_session`
- `prepare_release`
- `release_submitted`

## Handoff rule
Every implementation task must record branch/SHA, files changed, migrations, test result, known issues and rollback point before active-beta promotion.