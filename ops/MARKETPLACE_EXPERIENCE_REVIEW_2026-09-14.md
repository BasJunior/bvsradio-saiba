# Marketplace experience review — 14 September 2026

The seller desk now groups work into Overview, Your listings, Storefront and Availability. Creators can find live, draft, review and paused items, edit an existing listing without uploading its files again, and create a product or service through three focused steps. Storefront portrait and banner uploads include previews, progress and retry. Forms preserve changes after failed saves and token refresh, reset on account changes, and prevent concurrent saves.

Public marketplace search and provider filters also filter the map and service list. Storefronts show saved portraits, banners and listing artwork, offer service/download filters, and provide share-link feedback and load-error recovery. The workspace supports light/dark themes and phone widths. Editorial reviewers receive authorized, signed previews of draft images.

## Data and release boundaries

No migration is needed. Storefront images are typed entries in the existing profile portfolio JSON. Their paths are checked against the authenticated owner; public media access requires an approved profile. Product download files stay private. Seller saves cannot publish content: revised listings and profiles still use the existing editorial approval flow. The UI explicitly explains when saving a live item takes it offline for review.

This branch is based on d6acee3, including the prior participation review fixes. This marketplace task has not applied production SQL, changed environment variables, activated participation, or deployed either production host.

## Verification

- `npm run test:marketplace-experience`: runtime route tests for listing ownership, ID/file preservation, limits, draft rights confirmation, upload types/sizes, private image isolation, failure handling and authorized reviewer previews; timezone/DST validation; public image mapping.
- `npm run typecheck`: passed.
- `npm run build`: passed, including the existing marketplace/storefront and app-surface checks.
- `scripts/marketplace-browser-tests.mjs`: actual rendered Next/React pages with local fixture auth and intercepted API/storage requests. Exercises desktop/mobile listing edit, failed-save retry, draft save without re-upload, portrait/banner previews and upload, correct storefront links, token refresh, sign-out isolation, availability empty state, public search and offer filters. No live customer or production storage writes.
- Screenshots reviewed in light and dark themes. Corrected low-contrast light-mode controls found during visual review.

Browser verification uses Playwright, supplied via `BVS_PLAYWRIGHT_MODULE` when it is not installed in the project. Optional `BVS_BROWSER_EXECUTABLE` selects an installed Chromium browser. Start a local dev server on port 3124 with `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399` and `NEXT_PUBLIC_SUPABASE_ANON_KEY=review-local-anon`; this is a deliberately nonexistent test backend. Then run `node scripts/marketplace-browser-tests.mjs`. The test refuses non-local hosts. Screenshots default to `/tmp/bvs-marketplace-review` or `BVS_REVIEW_ARTIFACTS`.

## Release verification still required

Before production publication, deploy this reviewed branch to a preview/staging environment and verify one authorized seller's signed R2 upload through save, editorial image review and public storefront display. Local browser fixtures prove UI behavior, and route tests prove server decisions, but do not prove live R2 credentials/CORS or real provider delivery. Do not claim a production marketplace launch from these tests.
