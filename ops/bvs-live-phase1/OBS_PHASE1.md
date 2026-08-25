# BVS Live Phase 1 — OBS acceptance setup

Beta/staging only. Do not use production BVS hostnames or production credentials.

## OBS Custom service

- Service: `Custom...`
- Server: `rtmps://ingest-beta.bvsradio.com/live`
- Stream key: `evt_phase1test?sk=<temporary-phase1-secret>`
- Authentication checkbox: off

The secret is never part of the stream name or viewer URL. Do not paste the complete key into chat, tickets, screenshots or source control.

## Encoder baseline

Use H.264 video + AAC audio for the first acceptance test.

Recommended 720p30:
- Canvas/output: 1280x720
- FPS: 30
- Rate control: CBR
- Video bitrate: 3000–4500 Kbps
- Keyframe interval: 2 seconds
- Audio: AAC, 48 kHz, 160 Kbps stereo

Recommended 1080p30 if the uplink is stable:
- Canvas/output: 1920x1080
- FPS: 30
- Rate control: CBR
- Video bitrate: 4500–6000 Kbps
- Keyframe interval: 2 seconds
- Audio: AAC, 48 kHz, 160 Kbps stereo

Do not use HEVC/H.265 for Phase 1. Adaptive bitrate, multiple renditions and recording are out of scope.

## Acceptance sequence

1. Confirm the BVS stream row is `ready` and its validity window is open.
2. Open `https://bvsradio-beta.vercel.app/shows/bvs-live-phase1/watch` in a separate browser. Before OBS publishes, a 404 is expected because no live video URL exists yet.
3. In OBS, press **Start Streaming**.
4. SRS must call the beta `on-publish` hook and receive body `0`.
5. Confirm the beta show event becomes `live` and the Watch page serves the BVS TV experience.
6. Confirm picture and sound play from `https://stream-beta.bvsradio.com/live/evt_phase1test/index.m3u8`.
7. Press **Stop Streaming** in OBS.
8. SRS must call `on-unpublish`; the stream and show event become `ended`.
9. With no replay URL in Phase 1, the Watch page returning 404 after end is expected.

## Do not proceed if

- OBS reports a certificate warning.
- The ingest hostname resolves to the production web host.
- the HLS URL contains `sk=` or any part of the raw secret.
- the hook endpoint returns JSON instead of plain `0`/`1`.
- `bvsradio.com`, production Supabase, or iOS files are involved.
