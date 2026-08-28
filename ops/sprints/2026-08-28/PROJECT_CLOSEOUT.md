# BVS PROJECT CLOSEOUT — 2026-08-28

## A. Production (verified, not promoted)

| Item | Value |
|------|--------|
| Deployment | `dpl_ANWXUhGAiPmxYNM5hFYKmVTW1WKd` |
| SHA | `eb80df4f276c40461b8d849195f7d2dfa9f9dda3` |
| Canonical pointer | `origin/production/current` |
| GitHub main | `9b2c7a9` — **not live** |
| Web station | 65 |
| iOS station | 16 |
| `/app/ios` | HTTP 200 |
| Homepage / radio | HTTP 200 |
| Capacitor | `https://bvsradio.com/app/ios` |
| Health | no 5xx on probed routes |

## B. Candidates

| Candidate | Branch | State |
|-----------|--------|--------|
| C03 iOS lock | `saiba/prod-candidate-ios-surface-lock-2026-08-28` runtime `c0ede38` evidence `419bef3` preview `dpl_7hwSwfbJn6nBteZmAouzxLeFQSkD` | READY — OWNER APPROVAL REQUIRED |
| C01 Studio recut | `saiba/prod-candidate-studio-recut-2026-08-28` | READY — OWNER APPROVAL REQUIRED |
| C02 Lyrics recut | `saiba/prod-candidate-lyrics-recut-2026-08-28` | READY — OWNER APPROVAL REQUIRED |
| Old C01 | `saiba/prod-candidate-studio-intent-2026-08-28` @ `ba9dd2e6` | OBSOLETE — DO NOT PROMOTE |
| Old C02 | `saiba/prod-candidate-lyrics-pad-2026-08-28` @ `30889df8` | OBSOLETE — DO NOT PROMOTE |

## C. Database

- Production: no new migrations applied in this batch.
- Prepared: `supabase-song-workspaces.sql` (additive). Apply only with `C02_LYRICS_PROD_DB_AND_DEPLOY_APPROVED=YES`.

## D. iOS

- Native untouched.
- C03 freeze enforces `/app/ios` lock + Vercel build gates.
- Content process: Editorial queue; human clearance.

## E. Rights

Human-only. BVS iOS-cleared. OUTRO 1 already in the live 16. Other shortlist tracks wait Editorial.

## F. Analytics

Allowlisted + fired on recut candidates. No synthetic traffic. Observe genuine usage.

## G. Distribution

Stay on current staff pipe. Migrate only at documented scale triggers. See `ops/strategy/DISTRIBUTION_DECISION_2026-08-28.md`.

## H. Pricing

Live Standard $12 / $120. Instant $5.99 is not live. No live change.

## I. Remaining owner actions (approvals only)

1. `Approve Candidate 03 for production.`
2. Then recut/promote Studio from the **new** production SHA (or approve current recut if prod has not moved).
3. Lyrics: approve production DB + deploy separately.
4. iOS clearance: per-track human decision.
5. Pricing/Instant: explicit YES/NO.
6. Distribution vendor: none until a trigger fires.

## J. Rollback

Current production: `dpl_ANWXUhGAiPmxYNM5hFYKmVTW1WKd` / `eb80df4`.

## K. Planning leftovers

**None.** Planning backlog is zero. Normal operations continue: Editorial selections, genuine analytics, catalogue maintenance, rights review for newly selected tracks, future product requests.
