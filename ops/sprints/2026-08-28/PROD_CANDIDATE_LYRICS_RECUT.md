# Candidate 02 recut — Lyrics Pad / Song Workspace

**Status:** READY — OWNER APPROVAL REQUIRED  
**Branch:** `saiba/prod-candidate-lyrics-recut-2026-08-28`  
**Base:** live production `eb80df4` / `origin/production/current`  
**Old branch:** `saiba/prod-candidate-lyrics-pad-2026-08-28` @ `30889df8` — **OBSOLETE — DO NOT PROMOTE** (stacked on stale `main`).

## Product

Web-first Lyrics Pad on a paid BVS beat licence. Not Premium-based. Next genuine buyer is the usage test — no synthetic analytics.

Flow: buy licence → Library Owned (web only) → Lyrics Pad → Prepare release (`/upload?songWorkspace=`) → Rights Passport. Marker: `BVS_SONG_WORKSPACE:<id>`. Beat licence does **not** clear samples/features/compositions/third-party masters.

iOS library does **not** show Owned / Lyrics Pad (`LibraryView` is surface-gated).

## Database

Additive `supabase-song-workspaces.sql`. Applied on **beta** historically. **Not applied on production.**  
`C02_LYRICS_PROD_DB_AND_DEPLOY_APPROVED=YES` is required before production schema + deploy. Prefer app rollback without dropping tables.

## Tests

`npm run test:song-workspace` (wired into `vercel-build`).
