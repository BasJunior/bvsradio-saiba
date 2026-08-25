# BVS Live Phase 1 — beta implementation status

Locked lane: beta/staging only. This folder is not authorization to deploy production or touch the Apple-review surface.

## Current topology

```text
OBS
  | RTMPS :443 (SNI ingest-beta.bvsradio.com)
  v
HAProxy — TLS/SNI gateway
  | decrypted RTMP -> 127.0.0.1:1935
  v
SRS 6.0-r1
  |-- HLS -> 127.0.0.1:8080
  |             ^
  |             | Caddy 127.0.0.1:8081
  |             | ^
  |             | | decrypted HTTPS from HAProxy
  |             | +-- browser :443 (SNI stream-beta.bvsradio.com)
  |
  +-- HTTP hooks -> Caddy 127.0.0.1:9080
                         |
                         | injects BVS_LIVE_HOOK_SECRET
                         v
              https://bvsradio-beta.vercel.app/api/live/srs/*
```

One public IP is enough. HAProxy owns TCP/443 for both hostnames and routes by TLS SNI. Plain RTMP, SRS HTTP, Caddy HTTP and the hook relay stay loopback-only.

## Public beta names

- Control plane: `https://bvsradio-beta.vercel.app`
- OBS ingest: `rtmps://ingest-beta.bvsradio.com/live`
- HLS playback: `https://stream-beta.bvsradio.com/live/{public_id}/index.m3u8`
- Acceptance Watch page: `https://bvsradio-beta.vercel.app/shows/bvs-live-phase1/watch`

Production `ingest.bvsradio.com`, `stream.bvsradio.com` and `media.bvsradio.com` remain reserved and must not be bound in Phase 1.

## Beta fixture

The beta Supabase fixture has been created:

- programme slug: `bvs-live-phase1`
- show event: scheduled, public/unlisted, no end timestamp
- stream public/playback id: `evt_phase1test`
- media origin id: `beta-origin-1`

The stream row is intentionally `draft`, `key_active=false`, with a non-secret dummy hash until runtime secrets are installed. It cannot accept a broadcast in that state.

Run `npm run bvs-live:provision-phase1` only from a secure operator shell after the beta Vercel pepper/service credentials are present. It generates the real stream secret once, hashes it with the pepper, and changes only the beta Phase 1 fixture to `ready`.

## Runtime secrets

Never commit, screenshot or send these through chat:

- `BVS_LIVE_HOOK_SECRET` — same value in beta Vercel and the Caddy hook relay environment
- `BVS_LIVE_KEY_PEPPER` — beta Vercel + secure provisioning shell
- `BVS_LIVE_PLAYBACK_ORIGIN=https://stream-beta.bvsradio.com`
- existing beta Supabase server/service-role credentials

TLS private keys are runtime-only under the media-origin host.

## Network boundary

Public:
- TCP/443 — HAProxy only
- TCP/80 — only if required for ACME certificate issuance/renewal

Loopback only:
- TCP/1935 — SRS RTMP
- TCP/8080 — SRS HLS origin
- TCP/8081 — Caddy HLS HTTP backend
- TCP/9080 — Caddy SRS-hook relay

No SRT/WebRTC/UDP ports are part of Phase 1.

## Acceptance definition

The only Phase 1 success condition is:

OBS -> authenticated BVS ingest -> HLS -> existing BVS TV Watch page with picture + sound, then Stop Streaming -> `show_streams.status=ended` and `show_events.status=ended`.

Viewer counts, ABR, recording, chat, clips, Creator Studio controls, CDN and WebRTC remain out of scope.
