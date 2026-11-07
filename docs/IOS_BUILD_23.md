# BVS Radio iOS 1.5 build 23

Branch `claude/ios-pro-player-2026-11-07`, released to `main` at `c464d2c`.
Version 1.5 because 1.4 is live on the App Store (released 15 Oct 2026).

## What's new (App Store "What's New in This Version")

- A redesigned Now Playing screen with cover-art ambience and clearer controls.
- Choose where you listen: AirPlay and Bluetooth output from the player.
- Sleep timer: 15, 30, 45 or 60 minutes, or stop at the end of the track.
- Skip back 15 or forward 30 seconds in mixes and shows.
- Ask Siri: "Play BVS Radio", "Pause BVS Radio", "Skip this song on BVS Radio", "Open my BVS Radio library".
- New BVS Now Playing widget for your Home Screen and Lock Screen.
- Subtle haptic feedback on player controls.

## TestFlight "What to Test"

1. Play the station, open Now Playing: check the icons, the blurred cover background and the Output / Sleep / Up next bar.
2. Output: pick an AirPlay or Bluetooth speaker.
3. Sleep: choose End of track and confirm playback stops before the next song.
4. Play a mix or show longer than 10 minutes: try back 15 s / forward 30 s.
5. Feel for haptics on play/pause, skip and save.
6. Say "Hey Siri, play BVS Radio" with the app closed, then "Pause BVS Radio".
7. Add the BVS Now Playing widget (small and medium) to the Home Screen and a Lock Screen widget. Play a song, return Home: the widget should show the song and cover. Tap Listen, then the heart (Library).
8. Lock screen and Control Center controls, background audio and interruptions (phone call, Siri) still behave as before.

## Release checks (7 Nov 2026)

- Full `npm run build` (all gates + Next.js build) passed; deployed from `main` (`c464d2c`) to Vercel production `dpl` w6ocw6j3i at 15:26.
- Signed Release archive: `~/Library/Developer/Xcode/Archives/2026-11-07/BVSRadio-1.5-build23.xcarchive`. App and BVSWidget both signed with App Group `group.com.bvsradio.app`; provisioning profiles for `com.bvsradio.app` and `com.bvsradio.app.widget` created by automatic signing.
- App Store IPA exported locally: `artifacts/ios-release/export-23/App.ipa` (ignored by git).
- `xcodebuild -exportArchive` upload failed with the same App Store Connect account-provider error seen for build 17 ("Unexpected nil property at path: 'Actor/relationships/providerId'"). Upload through Xcode Organizer instead.
- Simulator: widget (small/medium), widget Listen/Library taps, Siri phrase registration, end-of-track sleep timer and native Now Playing verified. Not verified: physical-device haptics, AirPlay picker, Siri voice, Lock Screen widgets, push.
