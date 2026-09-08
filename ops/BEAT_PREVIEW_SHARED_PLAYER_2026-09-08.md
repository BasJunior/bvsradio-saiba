# Beat preview shared-player note

The native BeatStore detail preview intentionally uses the shared `StationPlayer` instead of mounting its own `<audio>` element.

Reason: the app has one persistent playback surface. Starting a beat preview must replace/pause the current recording rather than allow two independent audio elements to play simultaneously.

Regression expectation:
- `src/app/app/[surface]/beat/[id]/page.tsx` renders `AppBeatPreviewPlayer` and no native `<audio>` element.
- `AppBeatPreviewPlayer` calls `useStationPlayer()` and `player.playNow(...)` for a new preview, then `player.toggle()` when the same preview is already current.
