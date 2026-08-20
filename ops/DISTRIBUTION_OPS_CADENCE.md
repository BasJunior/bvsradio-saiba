# BVS store-delivery ops cadence (beta)

Public/artist copy never names the private aggregator. Staff may use the internal checklist in Editorial.

## Weekly (staff)

1. Open Editorial Command → filter **Needs action**.
2. For each `eligible` / `queued` job: confirm Premium still active, clearance approved, ISRC present, artwork/metadata complete.
3. Send the pack in the BVS-operated partner account (internal).
4. Mark job **submitted** when the partner accepts the delivery.
5. When stores show the release, mark **live_on_dsp** and paste Spotify/Apple URLs + ISRCs onto the BVS tracks (artist can also paste in Studio).
6. Failed/rejected: mark **failed**, write the blocker in notes, do not pretend it is live.

## Artist-visible states

| Status | What the artist should believe |
|--------|--------------------------------|
| not_eligible | On BVS only until Premium + packaging (clearance/ISRC) are complete |
| eligible | BVS will send — **not** on Spotify yet |
| queued | BVS is preparing the send |
| submitted | Stores are reviewing |
| live_on_dsp | BVS marked live — confirm the links on the release card |

## Do not

- Tell an artist a title is on Spotify because the job is eligible.
- Deploy this cadence to production while Apple Review is open.
- Skip the paid-unlinked Premium notification (`premium_paid_needs_user_link`).
