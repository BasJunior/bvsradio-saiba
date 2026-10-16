# BVS host team

The live shared programme uses two ElevenLabs voices across three shows, every day on the Africa/Harare clock (UTC+2 throughout the year):

| Zimbabwe time | Programme | Presenter | Delivery |
| --- | --- | --- | --- |
| 06:00–16:00 | Daylight (Daytime in the player) | Lily | Warm company, relaxed daytime introductions |
| 16:00–22:00 | Homebound (Evening in the player) | George | Clear, warm evening presentation |
| 22:00–06:00 | After Hours | Lily | Slower, quieter delivery and longer music runs |

Host links normally sit between three to five songs. After Hours uses five-song runs. Every sixth link cycle allows an eight-song stretch. Links last 8–15 seconds; the generator does not speed up finished audio. A clip slightly shorter than eight seconds may receive less than 1.1 seconds of trailing silence. Long/short scripts are rephrased; unacceptable clips are skipped.

The voice is synthesized. Artist names and song titles come from the approved station catalogue. Only existing approved pronunciations are used. Templates identify the presenter, introduce the upcoming song, and offer brief company. They do not invent credits, popularity, weather, news, or first-play claims. Human and guest inserts remain available through the existing desk.

## Live services and storage

- `bvs-station-engine.service`: shared programme clock used by the web/app players through `/api/station/now` and `/api/station/voice/{id}`.
- `bvs-host-team-refresh.timer`: runs the replenisher five minutes after its previous run ends. At most six candidate links per run; at most twelve fresh unused links per show. Prepares the current show and the next show when within ninety minutes of handover.
- `bvs-daily-mac-host.timer`: disabled. It generated the retired Samantha voice.
- Source: `ops/playout/host-team-refresh.mjs`; installed copy: `/opt/bvsradio/ops/playout/host-team-refresh.mjs`.
- Voice profiles: `eleven-lily-day`, `eleven-george-evening`, `eleven-lily-night`. Provider IDs and delivery settings are in `PROFILES` and the synthesis function.
- Audio is stored both under `/var/lib/bvs/station-host-audio/station-host/` and in the existing R2 bucket.
- Reusable synthesis cache: `/home/admin/.openclaw/cache/bvs-host-team`. Repeated factual introductions reuse audio, while each scheduled segment gets current catalogue facts and a new identifier.
- Existing configured ElevenLabs credential is resolved locally. No credentials are stored in this repository or systemd unit.

Missing host clips mean music continues. Another show's voice is never used as a fallback. A queued link is checked against the actual show time again before playback. The planner projects through music already queued and continues through the catalogue instead of always restarting its first tracks. Both normal playback and restart recovery maintain the station heartbeat.

The separate legacy Icecast feed is not the shared programme engine. This release changes the shared programme followed by the BVS player; it does not rebuild the standalone Icecast feed.

## Operations

Read-only supply check:

```sh
node /opt/bvsradio/ops/playout/host-team-refresh.mjs --dry-run
```

Bounded manual prewarming (honours a manually stopped host):

```sh
node /opt/bvsradio/ops/playout/host-team-refresh.mjs --session evening --limit 4
```

The timer uses `flock`; use the same `/home/admin/.openclaw/ops/bvs-host-team-refresh.lock` for manual runs once the service is enabled. The refresher never clears the editorial stop switch. Speech rate-limit/server errors get two bounded retries; rejected duration variants are cooled down for a day.

Activation uses `ops/playout/activate-host-team.mjs --apply`: requires three fresh clips for each show, saves a private backup, updates the three roster rows, and disables Samantha via audited existing RPCs in one transaction. Running without `--apply` is read-only. No schema migration or frontend deployment is required for roster names and voice IDs.

## Recovery

Runtime originals are in `/opt/bvsradio/backups/host-team-20261016/`; activation snapshots are in `/home/admin/.openclaw/backups/bvs-host-team-20261016/`. If speech generation fails, leave the approved audio and music running, inspect `journalctl -u bvs-host-team-refresh.service`, and repair the provider/configuration. Do not re-enable the old Samantha timer as an automatic fallback.

For a code rollback, stop the refresh timer, restore the two backed-up engine/library files, and restart the engine. This does not undo roster or segment-status changes. To reverse those, restore the backed-up roster through `bvs_station_set_session_voice` with current revisions and explicitly choose which old clips to approve. An editorial host stop provides a music-only fallback without disturbing music playback.
