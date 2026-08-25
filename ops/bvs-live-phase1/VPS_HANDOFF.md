# BVS Live Phase 1 — media-origin handoff

This is the first step that genuinely requires VPS/runtime access. Everything remains beta-only.

Do not touch `bvsradio.com`, production Supabase, production Vercel aliases, `/app/ios`, native iOS, production auth/player/payment paths, or the existing production web VPS.

## 1. Provision one isolated beta media-origin host

Recommended OS: current Ubuntu LTS.

Install:
- HAProxy
- Caddy
- Docker Engine (or an equivalent isolated SRS runtime)
- certificate tooling

Use SRS stable `ossrs/srs:v6.0-r1` / SRS `6.0.191`. After pulling, record the resolved immutable image digest. Do not report any credentials.

SRS may run with host networking so its listeners remain exactly the loopback addresses in `srs.conf`. Do not publish container RTMP/HLS ports directly.

## 2. DNS

Create beta-only records pointing to this media-origin IP:

- `ingest-beta.bvsradio.com`
- `stream-beta.bvsradio.com`

Do not create or change the production equivalents.

Only create AAAA records if IPv6 is actually configured and firewalled on the host.

## 3. TLS

Obtain trusted certificates for both beta hostnames. HAProxy is the only public TCP/443 listener and terminates TLS for both names.

Store HAProxy-compatible PEM material under `/etc/haproxy/certs/` with root-only permissions. No key or certificate private material belongs in git or chat.

Use `ops/bvs-live-phase1/haproxy.cfg` as the routing contract:

- SNI `ingest-beta.bvsradio.com` -> `127.0.0.1:1935` (SRS RTMP)
- SNI `stream-beta.bvsradio.com` -> `127.0.0.1:8081` (Caddy HLS HTTP)
- unknown SNI -> reject

## 4. Runtime configs

Install exactly from the reviewed branch:

- `ops/bvs-live-phase1/srs.conf`
- `ops/bvs-live-phase1/Caddyfile.phase1`
- `ops/bvs-live-phase1/haproxy.cfg`

Caddy needs `BVS_LIVE_HOOK_SECRET` in its service environment. Keep the value in a root-readable runtime environment file, not in the Caddyfile or shell history.

The same hook secret must be configured in the beta Vercel project.

## 5. Firewall

Public inbound:
- TCP/443 -> HAProxy
- TCP/80 only if required by the chosen ACME renewal method

Must not be publicly reachable:
- TCP/1935
- TCP/8080
- TCP/8081
- TCP/9080

No UDP/SRT/WebRTC ports are required in Phase 1.

## 6. Beta Vercel control-plane deployment

Deploy the exact reviewed `chatgpt/bvs-live-phase1` SHA to the **`bvsradio-beta` project only** (`prj_gv9stqkz190faX23mT3dy3wWStEo`).

Required beta runtime values:

- `BVS_LIVE_HOOK_SECRET=<secure random value>`
- `BVS_LIVE_KEY_PEPPER=<different secure random value, at least 32 bytes>`
- `BVS_LIVE_PLAYBACK_ORIGIN=https://stream-beta.bvsradio.com`
- existing beta Supabase URL/service-role values

Do not print the two random secret values in any report.

## 7. Activate the existing safe fixture

The database already contains `bvs-live-phase1` / `evt_phase1test` as inactive `draft` state.

From a clean checkout of the exact reviewed SHA, with **beta** Supabase server credentials and the same `BVS_LIVE_KEY_PEPPER` loaded only in the local shell, run:

```text
npm ci
npm run bvs-live:provision-phase1
```

The command displays the OBS stream key exactly once. Keep it on the operator machine and provide it to the broadcaster through the secure local process; do not send it in chat/Telegram or commit it.

## 8. Pre-OBS verification

Before broadcasting, verify and report only sanitized results:

- exact Git SHA deployed to `bvsradio-beta`
- beta Vercel deployment ID and READY state
- SRS version + immutable image digest
- HAProxy/Caddy/SRS service health
- both beta DNS names resolve to the media-origin IP
- both beta TLS names validate with a trusted certificate
- direct public access to ports 1935/8080/8081/9080 is blocked
- unauthenticated beta hook POST returns plain body `1`
- `evt_phase1test` is `ready` + active (never report its hash/secret)

Do not begin OBS if any of those checks fail.

## 9. Acceptance

Follow `OBS_PHASE1.md`.

Success is only:

OBS -> RTMPS -> HAProxy -> SRS -> authenticated publish hook -> HLS -> BVS beta Watch picture+sound -> Stop Streaming -> active unpublish -> stream/event `ended`.

Return sanitized timestamps/statuses and deployment/runtime IDs only. Never return the OBS key, hook secret, pepper, authorization header, SRS `param`, or service-role key.
