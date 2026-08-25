# BVS Live Phase 1 — SRS ingest callback contract

Beta/staging only. Production routes are not authorized.

## Endpoints

- `POST /api/live/srs/on-publish`
- `POST /api/live/srs/on-unpublish`

No GET. SRS receives plain-text response bodies only:

- HTTP 200 body `0` — allow/acknowledge
- HTTP 200 body `1` — reject/disconnect
- 5xx body `1` — fail closed

## Hook authentication

The media-origin loopback relay injects:

```text
Authorization: Bearer <BVS_LIVE_HOOK_SECRET>
```

`X-BVS-Live-Hook` is accepted as a compatibility alias. The app compares the supplied secret with `crypto.timingSafeEqual`. Missing/mismatched auth returns `1` and does not expose an auth error body.

Stock SRS callbacks are expected as `application/json`; the app also accepts form-encoded payloads for compatibility. The callback URL itself contains no secret.

Fields used:

- `action`
- `client_id`
- `ip`
- `vhost`
- `app`
- `stream`
- `param`
- `tcUrl`
- `server_id`

Unknown fields are ignored.

## Broadcast credential

OBS publishes:

```text
Server: rtmps://ingest-beta.bvsradio.com/live
Key:    evt_phase1test?sk=<secret>
```

After TLS termination SRS must see:

```text
app    = live
stream = evt_phase1test
param  = ?sk=<secret>
```

Legal stream IDs match `^evt_[a-z0-9]{8,16}$`. A combined `public_id.secret` is never a valid SRS stream name.

The secret is 32–128 hexadecimal characters. The raw value is never stored. The beta control plane verifies:

```text
HMAC-SHA256(BVS_LIVE_KEY_PEPPER, secret).hex == show_streams.stream_key_hash
```

For Phase 1, `playback_id = public_id` is a database constraint, producing:

```text
https://stream-beta.bvsradio.com/live/evt_phase1test/index.m3u8
```

No credential appears in the HLS URL.

## on_publish

The route fails closed unless all of the following hold:

1. hook secret valid
2. `action=on_publish`
3. `app=live`
4. stream ID valid and `client_id` present
5. exactly one valid `sk` exists in `param`
6. stream row exists
7. key active and not revoked
8. HMAC secret matches
9. stream status is `ready` or `live`
10. validity window is open
11. parent show event exists and is `scheduled` or `live`

The atomic database function then writes:

- `show_streams.status=live`
- current `active_client_id` and `active_server_id`
- first `started_at`, current `last_publish_at`
- HLS `live_playback_url`
- `show_events.status=live`
- same URL in `show_events.live_video_url`
- audit event `publish_accepted`

A replacement publish while already live is allowed. Its `client_id` becomes authoritative.

## on_unpublish

Unknown or already-terminal streams are acknowledged idempotently.

For a live stream, the atomic database function compares callback `client_id` with `show_streams.active_client_id`:

- mismatch — insert `stale_unpublish_ignored`, leave the replacement broadcast live, return `0`
- match — set stream and show event to `ended`, record timestamps/audit, return `0`

Phase 1 has no reconnect grace after the active publisher disconnects. No replay URL is written.

## Safe rejection reasons

Only these sanitized reasons may be persisted for known streams:

- `bad_hook`
- `bad_app`
- `bad_stream`
- `bad_secret`
- `unknown_stream`
- `inactive_key`
- `not_ready`
- `window`
- `no_event`
- `event_blocked`

Operational logs must never contain `Authorization`, `param`, `tcUrl`, the raw stream secret, service-role credentials, or raw database errors.

## Phase 1 boundary

Not included: reconnect grace, recording, Creator Studio key controls, key-rotation RPC, admin kick, ABR, CDN, SRT, WebRTC/WHEP, production hostnames.
