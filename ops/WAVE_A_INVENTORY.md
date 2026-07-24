# Wave A0 — Inventory (2026-07-24)

## Exists
- Creator Studio (`/creator/studio`) for artist releases, writers, shows
- Track upload via signed Supabase (`/api/tracks/upload` + prepare)
- Editorial dashboard track queue + approve/publish/rotation
- Catalogue BeatStore section (mostly static/pack beats)
- Access API: listener/artist/writer/showCreator/editorial/admin
- profiles.role: listener|artist|moderator|admin (CHECK constraint)
- Storage bucket `bvsradio-audio` + signed upload helpers
- Checkout treats `type=beat` at $29 server floor today

## Gaps for Producer BeatStore MVP
- No dedicated `beats` / `beat_licence_options` tables
- No producer flag/capability separate from artist
- No My BeatStore UI
- No beat editorial queue
- Public BeatStore not DB-backed for producer listings
- No beat-specific signed upload finalize path

## MVP decisions (agent defaults — Abias can override)
1. **Producer access:** `artist` and `admin` may manage BeatStore; owners/admin always. Optional `profiles.is_producer` boolean for explicit grants without new role enum breakage.
2. **Licence:** one **Standard lease** tier; producer sets USD price (min $1, default empty until set; catalogue fallback remains $29 for static packs only).
3. **Storage:** reuse `bvsradio-audio` with paths `beats/{userId}/...` (preview public-friendly; master private path prefix).
