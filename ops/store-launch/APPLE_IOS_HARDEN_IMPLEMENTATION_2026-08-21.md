# Apple iOS surface hardening — implementation handoff

Date: 2026-08-21
Branch: `apple/ios-surface-harden-1.0.3`
Base: `9b2c7a9dcbda5915ecaf7cf492bf3d0a7b684ca8` (`main` production lineage at branch creation)
Scope: surgical App Store 5.2.3 hardening only. No beta merge.

## Implemented boundary

- `/app/ios` remains the native start route.
- Native iOS same-origin navigation is allowed only within `/app/ios` and descendants by `MobileIosBoundary`.
- Website destinations outside that namespace are externalised on user click; a non-approved route reached by another means fails closed back to `/app/ios`.
- `capacitor.config.ts` no longer declares broad `allowNavigation` hosts. Build 3 has no extra navigation allowlist beyond the configured `server.url` origin.
- Ask BVS is gated out of `/app/(ios|android)` so it cannot surface broad website discovery links inside the review surface.

## Media gates

### Radio
`getStationTracks(surface)` still requires:

- `in_rotation=true`
- `is_public=true`
- `editorial_status=approved`
- inner joined `mobile_distribution_clearances.surface=<surface>`
- `mobile_distribution_clearances.status=cleared`

Additional Build 3 hardening:

- missing Supabase configuration now returns `[]` for mobile instead of archive fallback;
- mobile media must resolve to a first-party relative BVS path;
- unknown absolute CDN media is rejected;
- mobile artwork also fails closed when it remains an unknown absolute URL.

### BeatStore
Public BeatStore queries now require `rights_confirmed=true` in both the embedded-licence query and fallback query.
The mobile helper then additionally requires:

- at least one active, non-sold-out, positive-price licence;
- artwork/preview media to resolve to first-party relative BVS paths;
- unknown absolute preview URLs are omitted rather than played.

## Controlled mobile routes

- `/app/[surface]`
- `/app/[surface]/account`
- `/app/[surface]/artists`
- `/app/[surface]/artist/[slug]`
- `/app/[surface]/track/[id]`
- `/app/[surface]/beat/[id]`

The creator directory/profile/detail routes are derived only from the surface-cleared radio response and rights-confirmed BeatStore rows; they do not query or fall back to the wider website catalogue.

## External website handoff

Beat licence checkout, BVS stories and support remain website functions. Mobile links mark these as external destinations. The native iOS boundary prevents those website pages from becoming in-shell catalogue surfaces.

## Verification commands

```bash
npm run test:apple-ios-surface
npm run typecheck
npm run build
```

For the native Build 3 checkpoint:

```bash
BVS_MOBILE_SURFACE=ios npx cap sync ios
```

Then archive the existing bundle `com.bvsradio.app` as version 1.0 build 3.

## Deliberately not done here

- no merge of `saiba/bvs-radio-beta-shell`;
- no production deploy;
- no App Store Connect upload/reply;
- no changes to the five production iOS clearance decisions;
- no evidence-dossier rewrite (Saiba finish lane owns Build 3 addendum after runtime verification).
