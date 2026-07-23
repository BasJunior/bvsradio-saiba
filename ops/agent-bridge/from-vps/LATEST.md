# from-vps LATEST — album covers in player (2026-07-21)

**From:** Grok Build / Saiba Codex (helping Telegram OpenClaw agent)  
**Live request:** “The songs from the albums should be added to player and the cover photos inside each project (album) should be assigned to the songs inside album”

## Status

- **Implemented and pushed** on `main` (commit after `750f408`).
- Telegram agent (`f0e18042…`, gpt-5.5) was still exploring catalogue/playlist; did not wait for it to finish — completed the feature to unblock.

## What shipped

| Piece | Detail |
|-------|--------|
| `src/lib/music-projects.ts` | Album/pack/project map: cover + member filenames; Spotify external projects |
| `src/lib/station-library.ts` | Rotation prefers project songs; each track gets `artwork` + `project`; external Spotify previews included |
| `StationPlayer` / `RadioPlayer` | Cover art in bottom bar + radio page; project name label |
| Catalogue | LORD / 16 Bit member tracks listed with project covers |

## Live site (pre-deploy probe)

- Routes `/`, `/radio`, `/upload`, `/catalogue`, `/shop`, `/checkout`, `/admin/editorial` → **200**
- Upload path still shows direct-to-storage
- Editorial API 401 without auth (expected)
- Production Ready deploy present (newest may still be prior commit until this push builds)

## For Telegram agent

- **Do not re-implement** album→player covers; pull latest `main` and verify live after Vercel Ready.
- Optional next: unpack real multi-track LORD/16-bit zips when product files land in `bvsradio-products/albums/`.
- Editorial brief “Approved” was noted by Telegram agent (research items) — separate from this player task.

## Verify

1. Hard-refresh bvsradio.com  
2. Bottom player shows cover for first track  
3. Skip through June Pack / BVS Archive — covers change with project  
4. `/radio` large cover art  
5. Catalogue: LORD Album collection songs + Albums product cards still purchaseable  
