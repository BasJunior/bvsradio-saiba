# BVS Sales-Fix P0 Code Map (2026-09-04)

Worktree: bvsradio-sales-fix-2026-09-04 (branch saiba/sales-fix-hero-commerce-2026-09-04 @ ae02401)
Research: read-only scan of src/ for player, commerce, payments, analytics.

## 1. Global player / now-playing UI (Buy/Support CTA target)
- **Primary file**: `src/components/RadioPlayer.tsx`
  - Current now-playing bar + progress + cover + title/artist + shuffle/prev/play/next controls.
  - Uses `useStationPlayer()` hook.
  - Has `player.openNowPlaying()` for full view; error/notice banners.
  - Ideal insertion point for persistent "Buy track / Support artist" CTA next to controls or in expanded now-playing.
- **Related**:
  - `src/components/StationPlayer.tsx` — core audio logic + now-playing state.
  - `src/components/NowPlayingSwipeGestures.tsx` — mobile swipe handling for player.
  - `src/components/AlbumPlayer.tsx` — album-specific player variant.

## 2. How track download purchase works today (cart, checkout routes, APIs)
- **Cart**: `src/lib/cart-client.ts` — localStorage (`BVS_CART_KEY = "bvs_cart"`) + custom event `bvs:cart-updated`. Lines support `quantity`, arbitrary fields (incl. `licence_option_id`).
- **Checkout route**: `src/app/checkout/page.tsx` (and `/success`) — client cart hydration, tax calc (`lib/tax.ts`), Supabase integration, clears cart on success.
- **Pricing / licences**: `src/lib/catalogue-pricing.ts`, `src/lib/beat-licences.ts` — personal download, lease tiers, exclusive rights with specific licence text.
- **Marketplace / API**: `src/app/api/admin/editorial/marketplace/*` routes; `src/lib/marketplace-economics.ts`.
- Flow: Add to cart (client) → /checkout → (Stripe or Paynow) → success.

## 3. Payment method selection UI (Stripe/Paynow/etc) — making one primary rail
- **Libs**:
  - `src/lib/stripe.ts` + `src/lib/stripe-processor-fee.ts`
  - `src/lib/paynow.ts` + `src/lib/paynow-security.ts`
- **Checkout page** (`src/app/checkout/page.tsx`) handles both; currently multi-rail (user chooses?).
- **Tax / country**: `src/lib/tax.ts` (TAX_COUNTRIES, detectBrowserCountry).
- Gap: No single "primary rail" yet — checkout likely renders separate flows/buttons. Need consolidation (e.g. default to Stripe, Paynow fallback or vice-versa).

## 4. Where playback_error analytics are emitted and common failure paths
- **Emitters**:
  - `src/components/StationPlayer.tsx`: `trackEvent("playback_error", { track_id, stage: "start" | "track_change" })` on audio errors.
  - `src/components/ClientErrorBeacon.tsx`: duplicate emission paths.
- **Analytics registry**: `src/lib/analytics.ts` lists `"playback_error"` as tracked event.
- **Backend**: 
  - `src/app/api/admin/editorial/analytics/route.ts` — filters playback_error events.
  - `src/app/api/creator/analytics/route.ts` — counts playbackErrors per creator.
- Common paths: audio start failure, track change failure, network/media errors surfaced via player.error state.

## 5. Track page / explore item details commerce CTAs
- **Routes**:
  - `src/app/album/[slug]/page.tsx` (and layout) — track/album detail view.
  - `src/app/artist/[slug]/page.tsx` + `src/app/artist/premium/*` — artist pages with potential item listings.
  - Explore/catalogue likely under main app or community routes.
- Commerce CTAs currently minimal/absent in item cards/details (hence sales-fix); cart add is the entry point.

## 6. Any existing Support/tip/buy button components to reuse
- **None found** in `src/components/` matching Buy/Cart/Support/Tip/Purchase patterns.
- Closest: generic buttons inside `RadioPlayer.tsx`, `StationPlayer.tsx`, checkout form buttons, and admin/editorial finance components.
- Reusable patterns exist in UI kit (rounded-full bg-brand/20 etc.), but no dedicated commerce CTA component yet. Recommendation: create `BuyTrackButton.tsx` or extend RadioPlayer with commerce actions.

## Quick Recommendations (for sales-fix)
- Inject Buy/Support CTA into RadioPlayer + NowPlaying modal (point 1).
- Standardize payment rail in checkout (point 3).
- Surface download/purchase CTAs on album/[slug] and artist pages (point 5).
- Reuse cart-client + stripe/paynow libs; add primary-rail logic.

End of codemap. All findings from direct file reads + targeted searches. No code edits performed.