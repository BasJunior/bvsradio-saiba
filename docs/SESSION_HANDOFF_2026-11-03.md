# Homepage and Ask BVS handoff — 3 November 2026

This session works in the Documents/Codex bvsradio-saiba workspace. Local preview: http://localhost:3100. The separate Desktop release checkout is not the active source for this session.

Preserve the requested homepage order: Artists → Releases → Producers → BeatStore → Playlists → Shows → Marketplace. Releases is passed as a child between the two creator bands. The old Worth a listen / Your BVS / Studio promo rails are replaced by the compact listener/creator community closing section. Homepage comments identify the editing locations. Footer links now wrap into balanced groups and a separate legal row.

Homepage beat-card compact styling is scoped to `.bvs-home-beat-portrait` in creator-bands.css; it does not replace the catalogue grid. Preserve concurrent BeatStore heading/navigation work from main.

Ask BVS uses one conversation with a Premium button. Nonmembers see an offer popup. Current paid listener membership (BVS Supporter) and other current paid membership plans qualify; free, expired, shell, future and Premium Instant-only purchases do not. Premium access is verified server-side on every request. See PREMIUM_AI.md for the model credential, rate limit, limits and remaining real-account verification. No billing products, prices, memberships or database policies were changed.

Free guide improvements: verified catalogue discovery filters, explicit match reasons, ID-based server-resolved follow-ups, BPM-based slower/faster comparisons, no-repeat suggestions and direct navigation answers. Preserve the optional producer-profile-column fallback.

Regression commands: npm run test:home-load-performance; npm run test:ask-bvs; npm run test:premium-ai; npm run typecheck; npm run build. Premium/guide regressions are also in build preflight.

Local public Supabase configuration was repaired in ignored .env.local. Do not commit environment files or assume local credentials configure deployment environments. Premium model credentials were absent locally; no model activation, payment, upload or entitlement write was performed.
