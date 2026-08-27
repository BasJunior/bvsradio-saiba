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

### Connected beta Supabase (`kuqdhuomcqonhnwfgrlw`)
At sprint start/current check:
- public tracks: 2
- in-rotation tracks: 2
- public + in-rotation: 2
- editorial approved: 2
- `mobile_distribution_clearances`: 0 rows

## Important finding
The canonical beta station response and the connected beta Supabase inventory do not currently match each other, and neither mirrors production's 65/5 content state. Do **not** bulk-copy, clear, or expand rotation until the beta deployment's exact Supabase/environment mapping is resolved.

## Sprint implication
Content rollout work splits into two immediate tasks:
1. Resolve beta station data-source/environment mapping.
2. Build the admissibility inventory from the **production 65-track source of truth**, then deliberately stage approved candidates into the correct beta environment for QA.

No track is automatically deemed iOS-admissible by this inventory. Final rights decisions remain editorial/BVS decisions.