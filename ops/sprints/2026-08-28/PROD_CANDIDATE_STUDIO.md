# Production Candidate 01 — Intent-first Creator Studio

Status: **READY FOR HUMAN PREVIEW — NOT APPROVED FOR PRODUCTION**

## Goal
Promote the usability fix driven by real creator feedback without merging the 248-commit beta branch into production.

## Source / isolation
- production base: `main` at `9b2c7a9dcbda5915ecaf7cf492bf3d0a7b684ca8`
- candidate branch: `saiba/prod-candidate-studio-intent-2026-08-28`
- candidate head: `ba9dd2e6d5b2dd38d07a686406e5dcd7c9bc211c`
- candidate is 3 commits ahead of main and 0 behind at creation time
- production/main was not updated

## Candidate scope
Exactly 8 changed files vs main:
1. `src/app/creator/studio/page.tsx` — intent-first Studio front door
2. `src/app/creator/studio/manage/page.tsx` — preserves the current production full Studio verbatim
3. `src/app/creator/studio/create/release/page.tsx` — focused release route
4. `src/app/creator/studio/create/beat/page.tsx` — focused beat route
5. `src/app/creator/studio/create/service/page.tsx` — focused service route
6. `src/components/QuickBeatCreate.tsx` — simple beat submission
7. `src/components/QuickServiceCreate.tsx` — progressive service setup
8. `src/app/api/marketplace/route.ts` — accepts `recording` and `studio_session`, matching the focused service UI

## Production-specific adjustments
This is intentionally **not** a verbatim beta promotion.

- Money links to the existing production `/artists` wallet/earnings surface instead of beta `/creator/money`.
- The current production Studio is retained as `/creator/studio/manage`; no management capability is deleted.
- Legacy Studio hash links redirect to the retained manage route.
- No Song Workspace / Lyrics Pad code is included in this candidate.
- No creator income-ledger code is included.
- No signup, homepage, marketplace redesign, radio, iOS/native or station-content change is included.

## Backend compatibility verified
The existing main code already supports the focused flows:
- `/api/creator/workspace` supplies the role/activity data used by the front door.
- `/api/beats` already validates rights, verifies R2 upload paths, creates the beat and automatically seeds the Standard lease.
- `/api/beats/upload/prepare` already exists.
- `/api/marketplace?scope=mine` and `save_profile` / `save_listing` already exist.
- production Supabase already has beats, beat licence options, orders and Creator Marketplace tables.

The only API mismatch found was the focused UI offering `recording` / `studio_session` while main rejected those categories. Candidate adds those two accepted service-category strings.

## Build result
Vercel preview:
- deployment: `dpl_63EYJyDypMctRnV9S6BGQZkEnUrV`
- URL: `bvsradio-saiba-mtwaa4zol-saiba-bvs.vercel.app`
- state: **READY**
- Next build completed successfully
- compiled routes include:
  - `/creator/studio`
  - `/creator/studio/manage`
  - `/creator/studio/create/release`
  - `/creator/studio/create/beat`
  - `/creator/studio/create/service`

Preview is protected by Vercel SSO. A 302 to Vercel SSO is deployment protection, not an app route failure.

## Required human preview before production approval
On a creator account, check mobile and desktop:
1. `/creator/studio` clearly presents the creator's available jobs.
2. Release music opens the existing production release form.
3. Producer can post a beat without navigating Marketplace profile setup.
4. Service creator with no Marketplace profile gets minimal one-time setup.
5. Approved Marketplace creator gets focused service-listing form.
6. `Open full Studio` preserves all existing production management controls.
7. Existing deep links/hash links still reach the correct management section.
8. Money opens the existing production wallet/earnings path.

## Rollback
Because this candidate is based directly on current main, rollback is simply restoring main to `9b2c7a9d...` / redeploying the previous production build. No schema rollback is needed.

## Explicit production gate
Do **not** merge/update main or deploy this candidate to production without an explicit BVS production approval after the human preview.
