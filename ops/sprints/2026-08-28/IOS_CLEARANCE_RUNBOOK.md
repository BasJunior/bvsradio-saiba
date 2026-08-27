# iOS Content Clearance Runbook

Status: operating procedure for post-approval BVS rotation growth.

This runbook does not grant rights and does not authorize any production content change. Final clearance is a BVS human/editorial decision.

## Existing system of record
Use the existing Editorial track card at `/admin/editorial`.

The current UI and server already support:
- `not_reviewed`
- `cleared`
- `blocked`
- rights basis
- evidence reference
- private review notes

The server action is `set_mobile_clearance` and independently refuses `cleared` unless both a rights basis and evidence reference are present.

Do not add a parallel spreadsheet/database write process as the operational source of truth.

## What each status means

### `not_reviewed`
Default for tracks that have not completed the BVS mobile rights gate.

A web/editorial-approved/in-rotation track may still remain `not_reviewed` for iOS.

### `blocked`
Use when BVS has identified a specific reason the track should not appear on the mobile surface, including unresolved rights, an unsuitable/unfinished master, or another material clearance problem.

### `cleared`
Use only after a human reviewer is satisfied with the rights basis and retained evidence for the intended BVS mobile/radio use.

`editorial_status=approved`, verified credits, a Rights Passport, a DSP listing, or a founder instruction can support the review but none of them alone automatically means `cleared`.

## Evidence checklist
Before setting a track to `cleared`, confirm as applicable:
1. master owner/controller and basis of authority;
2. composition/songwriter/publisher authority;
3. performer/featured artist authority where third parties are involved;
4. producer/beat/sample/material authority where applicable;
5. retained evidence reference that BVS can retrieve later;
6. intended version/master is actually the version BVS wants to distribute;
7. explicit-content metadata is intentional and correct.

Record a concise rights basis and a durable evidence reference in Editorial. Put nuance or limitations in private review notes.

## New iOS expansion procedure
1. Candidate is already admissible for the web rotation.
2. Review the rights/evidence package against this runbook.
3. Keep unresolved candidates `not_reviewed` or mark `blocked` where appropriate.
4. For approved candidates, stage the intended iOS clearance in **beta first** using the same evidence standard.
5. Verify beta `GET /api/station/tracks?surface=ios` returns only the intended cleared set.
6. Smoke playback, artwork, title/artist metadata and explicit handling.
7. Record the exact candidate batch and evidence references.
8. Obtain explicit BVS approval for the production batch.
9. Only then use production Editorial to create/update the corresponding `ios` clearance rows.
10. Immediately verify production `GET /api/station/tracks?surface=ios` and smoke the real app/player.

Do not bulk-copy the web rotation into iOS.

## Current decision sequence
Before expansion:
1. Heavy — decide keep / replace final master / remove from iOS clearance. Production metadata currently calls the file an unfinished demo and `Still in progress`.
2. Thugging — close durable founder/master + composition evidence pack.
3. Jegera — close third-party master/performance/producer/composition authority pack.
4. On the Moon / Party Tarpy — confirm the already-referenced Amuse/UPC/ISRC evidence remains retrievable.

Then review expansion packages:
5. Whisper II Drive — Deep + Uptown Wins.
6. FRESHMAN MUSIK — OUTRO 1 + LIFE GAVE ME LEMONS + YOU ALREADY KNOWW.

See `IOS_RIGHTS_EVIDENCE_GATE.md` for the detailed evidence gaps.

## Fail-closed rule
The station API joins `mobile_distribution_clearances` for mobile surfaces. A track without an explicit `cleared` row for the requested surface must not appear there.

If a clearance row is removed, blocked, or left not reviewed, the mobile surface should exclude the track.

## Separation from App Store binary changes
Adding/removing properly cleared tracks from the already-supported radio/content surface is a content operation, not a reason by itself to ship a new native binary.

Material product/functionality changes exposed in the iOS app remain a separate release decision.

## Audit expectation
For every production batch retain:
- date/time;
- reviewer;
- track IDs/titles;
- prior and new status;
- rights basis;
- evidence reference;
- beta verification result;
- production `surface=ios` verification result;
- rollback/removal action if a problem is discovered.
