# Content / Station Baseline — 2026-08-27

## Verified deployed surfaces

### Production (`bvsradio.com`)
- `GET /api/station/tracks`: **65** web rotation tracks
- `GET /api/station/tracks?surface=ios`: **5** iOS tracks
- iOS remains fail-closed.

Current five iOS-visible titles:
1. On the Moon — BVS archive
2. Jegera — I Ratty
3. Thugging — BasJunior
4. Heavy — BasJunior
5. Party Tarpy — BVS archive

### Canonical beta (`bvsradio-beta.vercel.app`)
- `GET /api/station/tracks`: **1** web track (`Beta Qualification Track`)
- `GET /api/station/tracks?surface=ios`: **0** tracks
- `/api/build` reports beta SHA `124690a7f4dc1c7c` and environment `staging`.

### Connected beta Supabase (`kuqdhuomcqonhnwfgrlw`)
At sprint check:
- public tracks: 2
- in-rotation tracks: 2
- public + in-rotation: 2
- editorial approved: 2
- `mobile_distribution_clearances`: 0 rows

The two approved rotation rows are:
- `Beta Qualification Track` — local BVS placeholder media; returned by the station API.
- `River Lights (QA)` — Spotify preview URL (`p.scdn.co`); deliberately excluded by `station-library.ts`, which filters Spotify CDN preview URLs from rotation.

## Resolved finding
The canonical beta station result is consistent with the connected beta Supabase project: two approved rows exist, but one is intentionally filtered, leaving one playable beta station track. The deployment/data mapping therefore appears aligned.

Beta is intentionally a much smaller content environment than production; it does **not** mirror production's 65 web / 5 iOS catalogue.

## Sprint implication
1. Build the admissibility inventory from the **production 65-track source of truth**.
2. Select a small evidence-backed candidate batch.
3. Deliberately stage only those candidates into beta for iOS/content QA rather than bulk-copying production rotation.
4. Keep `surface=ios` fail-closed until explicit clearance rows are created after BVS review.

No track is automatically deemed iOS-admissible by this inventory. Final rights decisions remain editorial/BVS decisions.