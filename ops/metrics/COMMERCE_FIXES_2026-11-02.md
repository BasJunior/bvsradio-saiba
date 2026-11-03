# Commerce improvements — 2 November 2026

The home page now features the existing Basic Mix ($89), using the official catalogue price and package reference. No turnaround guarantee or before/after claim is invented. The booking action opens the existing checkout and replaces the service basket, matching the storefront behavior.

Offer visibility is measured at 50% intersection using the existing deployed event contract: `flow_object_open` with `funnel_stage=offer_view`. Explicit commercial actions emit `engagement_action_open` with `funnel_stage=offer_click`. Scope: featured home service, storefront services, beat licence cards, catalogue detail offers and full player download offers. `flow_object_open` with `funnel_stage=checkout_view` records the hydrated cart independently of daily platform visits. `checkout_started` at `source=checkout_submit` measures actual submission. Only payment reconciliation should emit `checkout_complete`; a pending order no longer emits it in the checkout page. Session-based stages and server confirmations are not a fully linked per-order funnel yet.

## Catalogue audit

Production Supabase: 187 tracks, 73 with is_downloadable=true and download_price>0, and 2 downloadable tracks with missing/nonpositive paid prices. These may intentionally be free: no prices or download permissions were changed.

## Workspace

VS Code is linked to Vercel saiba-bvs/bvsradio-saiba. The production site is https://bvsradio.com. Environment downloads are ignored by git. Development Vercel variables lack Supabase configuration; local .env.local has the verified production public URL and anon key, but the service-role secret is missing. Vercel masks production sensitive variables and downloads empty values; full local APIs remain blocked until a server credential is securely supplied. Payment and storage secrets are also absent. Local previews connect to a live database: do not submit purchases or destructive operations while inspecting.

Run the VS Code task BVS: local preview, or npm run dev -- --port 3100. Open http://localhost:3100 in the embedded browser for changes. Open https://bvsradio.com to inspect the current production release. Supabase console: https://supabase.com/dashboard/project/rdwwyolrxahimcgpkzzy . Vercel console: https://vercel.com/saiba-bvs/bvsradio-saiba . No deployment has been performed by this change.
