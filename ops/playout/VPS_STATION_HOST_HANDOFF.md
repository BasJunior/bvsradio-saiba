# VPS handoff — BVS station engine

This file is for the VPS agent. It was not sent over Telegram. Do not print secret values into logs, unit files, or chat.

Nothing here has been run on the VPS. Local tests used an embedded Postgres and a simulate output. Icecast, DNS, TLS, and a zero-listener airing still need a live check.

## What to install

- Node.js 22 or newer
- ffmpeg
- icecast2
- The app checkout at the station-host revision, suggested directory `/opt/bvsradio`
- A service user `bvs` that can read `/etc/bvs/station-engine.env` and write `/var/lib/bvs/station-host-audio`

The engine does not listen on a public port. Icecast source port stays on localhost.

## Secrets file

Create `/etc/bvs/station-engine.env` mode `0640`, owner `root`, group `bvs`. Names only:

- `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BVS_PLAYOUT_STATION_ID` (the same value the web app allows)
- `BVS_PLAYOUT_SIGNING_SECRET` (32 characters or more, server-only, never `NEXT_PUBLIC`)
- `BVS_PLAYOUT_ENDPOINT` (the deployed `https://<app-host>/api/internal/playout/started`)
- `XAI_API_KEY` (only if this host also generates speech; otherwise set it on the app host)
- `BVS_HOST_VOICE_ID` (optional, default `ara`)
- `BVS_HOST_AUDIO_DIR` (suggested `/var/lib/bvs/station-host-audio`)
- `BVS_PLAYOUT_OUTPUT` (`timeline` first, then `icecast`)
- `BVS_LIVE_STREAM_PUBLIC_URL` (`https://stream.bvsradio.com/bvs`, no username or password)
- `BVS_ICECAST_HOST` (`127.0.0.1`)
- `BVS_ICECAST_PORT` (`8000`)
- `BVS_ICECAST_MOUNT` (`/bvs`)
- `BVS_ICECAST_SOURCE_PASSWORD`
- `BVS_APP_ORIGIN` (https app origin, used only if a voice file is not on local disk)
- `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (when audio is stored in the existing bucket)

The app host needs the same playout id, signing secret, Supabase service role, and `XAI_API_KEY`. Do not put the Icecast source password in the public URL or in the Next.js browser env.

## Icecast and TLS

- Bind Icecast to `127.0.0.1:8000` only. Do not open 8000 in the firewall.
- Mount point `/bvs`.
- Source user `source`. Password from `BVS_ICECAST_SOURCE_PASSWORD`.
- Public listener URL `https://stream.bvsradio.com/bvs`.
- DNS: `stream.bvsradio.com` to this VPS.
- TLS: terminate on the existing reverse proxy, port 443, and proxy to `http://127.0.0.1:8000/bvs`.
- The proxy must not forward the source password and must not log the source URL.

ffmpeg reads each item at realtime and encodes 128 kbps MP3 to the Icecast source. If ffmpeg is missing, the engine keeps the programme clock in timeline mode and listeners use `/api/station/now` instead of the live mount.

## Service

The unit example is `ops/systemd/bvs-station-engine.service`.

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin bvs || true
sudo mkdir -p /etc/bvs /var/lib/bvs/station-host-audio /opt/bvsradio
sudo chown -R bvs:bvs /var/lib/bvs /opt/bvsradio
sudo install -m 0640 -o root -g bvs /dev/null /etc/bvs/station-engine.env
# write the names above into that file locally; do not commit it
sudo cp ops/systemd/bvs-station-engine.service /etc/systemd/system/bvs-station-engine.service
sudo systemctl daemon-reload
sudo systemctl enable --now bvs-station-engine.service
sudo systemctl status bvs-station-engine.service --no-pager
sudo journalctl -u bvs-station-engine.service -n 50 --no-pager
```

Start with `BVS_PLAYOUT_OUTPUT=timeline`. Switch to `icecast` only after the timeline checks pass, then restart the unit.

## Checks the VPS agent must run

These are not done yet:

1. `systemctl is-active bvs-station-engine` is `active`.
2. With zero browsers, `/api/station/now` shows `onAir: true` within 20 seconds of a track start.
3. One new `track_broadcast_events` row exists for that track. Repeating the same event id does not add a second row.
4. Remove or rename one voice file. The log shows a playback failure and the next item is music. The music row is acknowledged.
5. Stop the host from `/admin/station-host`. The current voice ends immediately. Music continues.
6. Disable the host. New voice items are skipped. Music still acknowledges.
7. `curl -I https://stream.bvsradio.com/bvs` returns audio headers and the URL contains no userinfo.
8. `journalctl -u bvs-station-engine` contains none of the secret values named above.

Do not apply database migrations from the VPS unless the app operator asks. Do not merge or deploy the web app from this handoff.
