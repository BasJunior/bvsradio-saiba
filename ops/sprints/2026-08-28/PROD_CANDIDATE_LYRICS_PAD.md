# Production Candidate 02 — Purchased-beat Song Workspace / Lyrics Pad

Status: **BUILD READY — NOT APPROVED FOR PRODUCTION**

This candidate is deliberately downstream of Production Candidate 01 (intent-first Creator Studio). It is not a beta-branch merge.

## Base / isolation
- current production base at candidate creation: `main` = `9b2c7a9dcbda5915ecaf7cf492bf3d0a7b684ca8`
- Candidate 01 base/head: `saiba/prod-candidate-studio-intent-2026-08-28` = `ba9dd2e6d5b2dd38d07a686406e5dcd7c9bc211c`
- Candidate 02 branch: `saiba/prod-candidate-lyrics-pad-2026-08-28`
- Candidate 02 head: `30889df8d77714a8dcc8e9a89f876781efbf9b76`
- Candidate 02 is 6 commits ahead of Candidate 01 and 0 behind it at validation time.

Production/main was not updated.

## Purpose
After a signed-in user buys a BVS beat licence:
- receipt can launch a private Lyrics Pad;
- Library gains `Owned` for purchased beat licences;
- Studio can resume songs from licensed beats;
- lyrics/notes autosave in a private Song Workspace;
- `Prepare release` carries the BVS-issued beat licence into the release Rights Passport path;
- the user does not have to upload proof of a licence that BVS itself sold.

## Candidate 02 delta vs Candidate 01
15 files:
1. `package.json`
2. `scripts/song-workspace-tests.mjs`
3. `src/app/account/orders/[reference]/page.tsx`
4. `src/app/api/account/orders/[reference]/route.ts`
5. `src/app/api/creator/song-workspaces/[id]/route.ts`
6. `src/app/api/creator/song-workspaces/route.ts`
7. `src/app/api/library/owned/route.ts`
8. `src/app/creator/studio/create/release/page.tsx`
9. `src/app/creator/studio/page.tsx`
10. `src/app/creator/studio/songs/[id]/page.tsx`
11. `src/app/library/page.tsx`
12. `src/components/ReleaseSubmitForm.tsx`
13. `src/components/SongWorkspace.tsx`
14. `src/lib/song-workspaces-server.ts`
15. `supabase-song-workspaces.sql`

## Production-specific adaptation
This is not a verbatim copy of the later beta UI.

- Library `Owned` was adapted onto the current production Library instead of importing unrelated later Flow/Your BVS UI.
- Studio integration preserves Candidate 01's production-specific Money link (`/artists`) instead of beta `/creator/money`.
- producer display naming uses current production `creatorPublicName`; it does not depend on the later beta-only `producerPublicName` helper.
- core receipt/release changes were safely transplantable because their immediate pre-Lyrics blobs in the beta lineage were identical to current main.

## Security / entitlement model
The browser does not decide ownership.

Workspace creation requires the server to find:
- the signed-in user;
- an order owned by that user;
- order status `paid` or `fulfilled`;
- the requested beat inside that order.

Workspace reads/updates are owner-scoped.

The writing surface plays the beat preview only; it does not expose a producer's private master/stems.

Browser PATCH does not accept arbitrary `releaseId` mutation.

BVS-issued release evidence uses `BVS_SONG_WORKSPACE:<workspace-id>` and the database trigger re-verifies buyer/order/release ownership before auto-approving that BVS licence evidence.

## Build gate
Candidate 02 adds:
- `npm run test:song-workspace`
- `vercel-build = npm run test:song-workspace && next build`

Latest validated Vercel preview:
- deployment: `dpl_AwyS3DB52EW61NYLcHhSyZztDggm`
- URL: `bvsradio-saiba-n5ym75qcr-saiba-bvs.vercel.app`
- commit: `30889df8d77714a8dcc8e9a89f876781efbf9b76`
- state: **READY**

Build sequence verified:
1. Song Workspace entitlement regression tests passed.
2. Next/Turbopack compiled successfully.
3. TypeScript completed successfully.
4. Routes compiled, including `/api/creator/song-workspaces`, `/api/library/owned`, `/creator/studio/songs/[id]`, `/creator/studio/create/release`, `/library`.

Do not runtime-smoke this production-project preview against account data until its preview environment mapping is deliberately confirmed; the schema is intentionally not present in production yet.

## Required production migration
Production Supabase currently does **not** have `public.song_workspaces`.

`supabase-song-workspaces.sql` must be reviewed and applied to the production Supabase project **only after explicit production approval**.

The migration creates:
- `song_workspaces` keyed to authenticated user, order, beat and optional licence option;
- unique `(user_id, order_id, beat_id)` constraint;
- RLS with owner-only SELECT;
- no direct browser INSERT/UPDATE/DELETE policy;
- a security-definer trigger to verify BVS Song Workspace licence evidence during release clearance.

No production migration has been applied as part of candidate preparation.

## Production promotion order if approved later
1. Freeze/record current production Git SHA, Vercel deployment and Supabase recovery point.
2. Re-review `supabase-song-workspaces.sql` against current production schema.
3. Apply the Song Workspace migration to production Supabase.
4. Verify table, RLS policy, unique constraint and clearance trigger.
5. Promote Candidate 01 / Candidate 02 code according to the approved release plan.
6. Verify unauthenticated Workspace and Owned routes fail closed.
7. Signed-in paid beat buyer smoke: receipt → Owned → workspace → save/reopen.
8. Verify `Prepare release` carries the leased-beat context and BVS workspace marker.
9. Monitor runtime errors and support issues.

## Rollback
Code rollback:
- redeploy the previous production build / restore main to the recorded pre-promotion SHA.

Database rollback preference:
- do not immediately drop `song_workspaces` on a code rollback if real user lyrics have been written; leaving the unused private table in place preserves customer data.
- disable/remove feature entry points through code first.
- any destructive schema rollback requires a separate explicit data-retention decision.

## Product rollout stance
User has accepted Lyrics Pad as sufficiently tested for this stage. It is expected to be low-frequency initially and should be observed passively once real buyers use it.

That acceptance does **not** itself authorize a production deploy. Candidate 02 exists so the web feature can be promoted safely when BVS chooses, without merging the wider beta branch.
