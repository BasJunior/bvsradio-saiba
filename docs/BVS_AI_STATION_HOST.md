# BVS AI station host

One shared programme. The server decides the sequence. Listeners follow it.
The AI host speaks about every three to five tracks, usually for 8–15 seconds,
and only from a line editorial staff have approved. Human presenter and guest
audio uses the same clock. If a voice file or the speech service fails, the
next record still plays.

The day uses three sessions on the Africa/Harare clock: Daytime 06:00–16:00
(Ara), Evening 16:00–22:00 (Rex), and After hours 22:00–06:00 (Sal). One host
stays with a session. A session with no approved line keeps using the approved
clips already on the station. Editorial can rename a host or change that
session’s voice from `/admin/station-host`. New lines are generated for whoever
is on the clock, then previewed and approved before they air.

## What is proof

- Only `ops/playout/station-engine.mjs` may call `reportSignalStarted`.
- It does that after music output has started, with the outbox event id and
  the original start time. Retries reuse both.
- `bvs_station_plan_items` never writes `track_broadcast_events` or `started_at`.
- Voice items never open an acknowledgement, even if a caller asks for one.
- `/api/tracks/play` and a browser following `/api/station/now` are not First Spin.
- Zero listeners still produce a First Spin when the engine starts the record.
- A stale engine heartbeat (more than 20 seconds) makes `/api/station/now`
  report off air. Browsers then use the old local rotation, which still cannot
  prove a broadcast.

## Editorial desk

`/admin/station-host` is limited to staff who can schedule programmes or manage
rotation. They can preview, edit, approve, and disable a line, approve an
artist pronunciation, stop the host immediately, and attach presenter or guest
audio. Approving an AI line requires audio of 8–15 seconds and an approved
pronunciation. Editing a line clears its audio and returns it to review.
Stopping the host skips the current and scheduled voice items. Music continues.

Scripts may use only the artist, the approved spoken form, the title, genre,
the saved editorial reason, and the broadcast ledger. “First time on BVS” is
allowed only when the ledger count is zero. “First Spin” is allowed only when
that ledger already has an airing. A model line that adds popularity, credits,
or an unproved milestone is discarded for the grounded line.

## Rollout

Do not treat a merged pull request as production activation.

1. Ship PR 181, including `20261015074532_bvs_signal_trusted_journey.sql`,
   or confirm that migration is already applied. Do not re-apply an older copy.
2. Apply `supabase/migrations/20261015183000_bvs_ai_station_host.sql`.
3. Deploy the application. Set server-only `XAI_API_KEY`, `BVS_HOST_VOICE_ID`
   (default voice `ara`), and the existing playout and Supabase secrets.
4. Start the engine in `BVS_PLAYOUT_OUTPUT=timeline` and confirm
   `/api/station/now` with no browser open.
5. Move to Icecast only after the timeline check. See
   `ops/playout/VPS_STATION_HOST_HANDOFF.md`.
6. Staff approve pronunciations, generate or upload lines, preview them, then
   approve. Enable the host last.
7. Air one approved track with zero browsers. Confirm one
   `track_broadcast_events` row. Replay the same event id and confirm it does
   not duplicate. Confirm a missing voice file skips to music.

The migration has been executed against embedded PostgreSQL in
`node scripts/bvs-station-host-tests.mjs`. That is not a production migration
and not a live airing.

## Local checks

```bash
node scripts/bvs-station-host-tests.mjs
node scripts/bvs-signal-tests.mjs
npx tsc --noEmit
npx eslint src/lib/station-programme.ts src/lib/station-host-server.ts src/lib/station-host-generate.ts src/app/api/station src/app/api/admin/station-host src/app/admin/station-host src/components/StationPlayer.tsx src/components/RadioPlayer.tsx
```
