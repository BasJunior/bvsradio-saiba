# Production Candidate 01 — Automated Smoke Gate

Candidate branch: `saiba/prod-candidate-studio-intent-2026-08-28`

Candidate head: `ba9dd2e6d5b2dd38d07a686406e5dcd7c9bc211c`

Preview deployment: `dpl_63EYJyDypMctRnV9S6BGQZkEnUrV` — READY

Production `main` was not changed.

## Automated / code-level checks

PASS — Creator Studio keeps authentication in front of creator data. The front door requests `/api/creator/workspace` using the signed-in Supabase bearer token and shows a sign-in state when there is no session.

PASS — The simplified Studio exposes the three intended creation jobs only when appropriate:
- Release music — Artist/Admin
- Sell a beat — Producer/Admin
- Offer a service — available from the Studio front door, with server-side marketplace entitlement/role checks still authoritative

PASS — Existing deep links and legacy Studio anchors are preserved. Known hashes redirect to `/creator/studio/manage#...` rather than breaking old links.

PASS — The full legacy Studio still exists at `/creator/studio/manage`; Candidate 01 is a new front door, not a deletion of the existing management surface.

PASS — Focused creation routes exist:
- `/creator/studio/create/release`
- `/creator/studio/create/beat`
- `/creator/studio/create/service`

PASS — The beat route delegates to the existing `QuickBeatCreate` flow rather than creating a second beat-submission backend.

PASS — The service route delegates to the existing `QuickServiceCreate` flow. The marketplace API accepts the focused `recording` and `studio_session` categories in addition to the existing service categories, preventing the new form from producing a category-validation 400.

PASS — Money remains on the current production wallet path (`/artists`) rather than importing the newer beta creator-income ledger.

PASS — Catalogue/status, orders, storefront, writer and show tooling still route into the existing production management surfaces.

PASS — Candidate 01 requires no Supabase migration.

PASS — Vercel preview build completed successfully on the current production codebase.

## Preview limitation

The preview is protected by Vercel SSO. The connector can generate a temporary share URL but cannot persist the SSO cookie across automated route fetches, so this is not a substitute for a human visual/mobile preview.

This is an environment/tooling limitation, not an observed application failure.

## Remaining gate

Only a short human preview remains before production approval:
1. sign in with a creator account
2. open Studio on phone and desktop
3. confirm Release music / Sell a beat / Offer a service cards are understandable and reachable
4. open Full Studio and confirm old management tools are still available
5. check that the Money link reaches the existing wallet/earnings surface

If those visual/navigation checks pass, Candidate 01 is technically ready for an explicit production promotion decision.
