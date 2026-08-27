# Production Promotion Package — Candidate 01: Intent-first Creator Studio

Status: **PREPARED — AWAITING HUMAN PREVIEW + EXPLICIT BVS PRODUCTION APPROVAL**

This document prepares the production promotion only. It does not authorize a production change.

## Exact source state
- current production `main`: `9b2c7a9dcbda5915ecaf7cf492bf3d0a7b684ca8`
- candidate branch: `saiba/prod-candidate-studio-intent-2026-08-28`
- candidate head: `ba9dd2e6d5b2dd38d07a686406e5dcd7c9bc211c`
- compare at promotion-package creation: **3 commits ahead / 0 behind**
- merge base: current production main SHA above
- candidate preview deployment: `dpl_63EYJyDypMctRnV9S6BGQZkEnUrV` — READY
- schema/database migration: **none**
- payment-price change: **none**
- iOS/native change: **none**
- station/content clearance change: **none**

## Promotion method after explicit approval
Because the candidate is directly based on current `main` and remains 0 commits behind, promote by a **fast-forward of `main` to the exact candidate head**. Do not merge the beta branch and do not include Candidate 02 / Lyrics Pad.

Before moving `main`, re-run the compare. The promotion must stop if:
- `main` is no longer exactly the recorded base or the candidate is behind,
- the candidate SHA changed,
- the diff contains files outside the approved Candidate 01 scope,
- a database migration appears,
- the preview is no longer READY,
- production approval is not explicit.

## Approved Candidate 01 file scope
1. `src/app/creator/studio/page.tsx`
2. `src/app/creator/studio/manage/page.tsx`
3. `src/app/creator/studio/create/release/page.tsx`
4. `src/app/creator/studio/create/beat/page.tsx`
5. `src/app/creator/studio/create/service/page.tsx`
6. `src/components/QuickBeatCreate.tsx`
7. `src/components/QuickServiceCreate.tsx`
8. `src/app/api/marketplace/route.ts`

## Pre-deploy gate
Immediately before promotion verify:
- production `main` SHA still equals `9b2c7a9d...` unless a new production change has been separately reviewed,
- candidate still equals `ba9dd2e6...`,
- compare remains 3 ahead / 0 behind with the same 8-file scope,
- preview `dpl_63EY...` remains READY,
- no production database write is required,
- explicit BVS approval has been received in the active conversation / release record.

## Expected production behavior
After Git/Vercel production deployment:
- `/creator/studio` shows the intent-first front door,
- existing full Studio is preserved at `/creator/studio/manage`,
- legacy Studio hash links redirect into `/creator/studio/manage#...`,
- Release music opens `/creator/studio/create/release`,
- Sell a beat opens `/creator/studio/create/beat`,
- Offer a service opens `/creator/studio/create/service`,
- Money continues to use the existing production wallet/earnings route,
- Recording and Studio Session service categories are accepted by the existing Marketplace API,
- no Lyrics Pad / Song Workspace surface appears from this candidate.

## Post-deploy smoke — required
Run immediately after the production deployment is READY:
1. record deployed production SHA and Vercel deployment ID,
2. verify homepage and `/radio` still respond normally,
3. verify `/creator/studio` loads and unauthenticated users get the existing sign-in path,
4. signed-in creator: verify Studio front door,
5. artist: open Release music and ensure the existing release form loads,
6. producer: open Sell a beat and ensure the focused form loads,
7. creator: open Offer a service and ensure category selection includes valid production categories,
8. open Full Studio and verify management controls remain available,
9. check a legacy Studio hash route redirects to the matching manage section,
10. verify production station counts are unchanged by the rollout (web rotation and iOS-cleared set),
11. check production runtime logs for new 5xx errors on Creator/Marketplace routes.

## Rollback trigger
Rollback if any of the following occurs after production deploy:
- Studio becomes unavailable to an existing creator role,
- full Studio management is lost,
- release / beat / service creation routes fail materially,
- Marketplace API begins returning unexpected 5xx responses,
- unrelated production surfaces regress.

## Rollback target
Known-good Git state before Candidate 01:
`9b2c7a9dcbda5915ecaf7cf492bf3d0a7b684ca8`

No database rollback is required because Candidate 01 has no schema migration.

Prefer a history-preserving rollback (revert/restoration commit or Vercel rollback to the previous production deployment) rather than force-rewriting `main`. Record the rollback deployment/SHA if used.

## Hard stop
**Do not update `main`, trigger a production deployment, or modify production data until BVS explicitly approves Candidate 01 for production after the human preview.**
