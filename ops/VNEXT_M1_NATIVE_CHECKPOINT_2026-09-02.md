# vNext M1 native integration checkpoint

This is a build/integration checkpoint, **not TestFlight acceptance**.

## Source and isolation

- Branch: `saiba/app-vnext-2026-09`.
- Starting SHA: `341125ef42fc38d83c6c1ff4d5f2ddd66b85ce81` (freshly fetched branch tip).
- Reused the previously clean app-flow checkout; its old branch remains preserved.
- Production, current beta, Apple-rights checkout and EcoCash WIP were not edited.
- No SQL, production database, Apple portal or App Store Connect changes performed.

## Actual iOS build failure and correction

The current Swift offline plugin compiled. The failure was Xcode's script sandbox denying CocoaPods' framework-embedding shell script. Declaring inputs alone exposed a second problem: rsync's temporary outputs are incompatible with the generated literal sandbox output paths.

The Podfile now keeps script sandboxing and dynamic framework linkage, but replaces that generated embed script with Xcode's native Copy Files phase. Frameworks use `CodeSignOnCopy` and `RemoveHeadersOnCopy`. The hook supports the present source-built frameworks and fails explicitly if future dependencies need different handling. Consecutive Capacitor syncs leave the project byte-identical.

## Installed capabilities

- Official Capacitor App, Network, Preferences, Push Notifications, Share, Splash Screen and Status Bar plugins are installed and synced.
- Existing `BvsOfflineMediaPlugin` remains registered by the custom bridge controller.
- Added APNs registration/error forwarding, Push/Associated Domains target capabilities, Debug development / Release production APNs entitlement substitution, and `applinks:bvsradio.com`.
- Added the `bvsradio` URL scheme and explicit app file-sharing restrictions.
- Added UserDefaults required-reason privacy declaration (`CA92.1`). This does not replace the eventual complete App Privacy assessment.
- Committed CocoaPods lockfile and workspace for reproducibility.

## Reproduction

```sh
npm ci
npm run test:app-links
npm run test:native-config
npm run test:native-contract
npm run test:safe-floor
npm run typecheck
npm run build
```

For compile-only CI, generate the small local `out/index.html` as in `.github/workflows/native-vnext.yml`, then:

```sh
BVS_APP_VARIANT=vnext BVS_MOBILE_SURFACE=ios \
  BVS_MOBILE_URL=https://vnext-native-ci.invalid/app/ios npx cap sync ios
xcodebuild -workspace ios/App/App.xcworkspace -scheme App \
  -configuration Debug -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

**The `.invalid` URL is intentionally non-runnable and must never be archived/uploaded.** Device builds need an explicitly approved isolated deployment/backend, supplied through `BVS_MOBILE_URL`. The vNext variant retains `com.bvsradio.app`, rejects production/current-beta hosts, and requires `/app/ios` or `/app/android`.

## Local objective evidence

- Simulator compilation: PASS (Xcode 26.6, workspace; nine embedded frameworks including Capacitor/Cordova and seven official plugins).
- Repeat Capacitor sync/pod install: PASS, project SHA-256 unchanged on repeat.
- TypeScript: PASS after preserving/removing a stale ignored Next.js cache from the previous branch.
- Production-mode web build: PASS (`npm run build -- --webpack`). This was a local compilation, not a production deployment.
- App-link, configuration isolation, native source-contract, safe-floor, marketplace-economics and signup-role tests: PASS.
- Focused ESLint on config/new test scripts, plist validation, and `git diff --check`: PASS.
- Source-contract tests are structural checks, not plugin execution or device acceptance.
- GitHub Actions now runs iOS, Android and web checks together. Consult the pushed commit's actual run for the final CI result.

## Device/signing and outstanding gates

The paired USB device is an iPhone 15 running iOS 26.6. It has **not** received this checkpoint build. Existing older BVS device walkthroughs do not count as vNext acceptance.

The project and current checked-in AASA agree on team `VGFK77VH73`. An existing local older BVS profile independently identifies that team, but is a wildcard development profile: this is **not** proof of current APNs, associated-domain or distribution provisioning. Verify the actual `com.bvsradio.app` App ID and release profile before signing a device/release binary. Marketing/build version remains unchanged at 1.0 (1); a new available build number must be selected before any archive.

The known Vercel vNext preview is on the same Vercel project as production. A preview deployment does not prove Supabase isolation. No verified dedicated vNext backend was supplied; the SQL packs remain intentionally unapplied. Do not perform authenticated, playlist, push-token, community or download write tests against an unknown backend.

Remaining runtime work is real, not merely a paperwork gate:

- Offline storage/licence methods exist, but the current downloads UI/plugin contract has no completed playback path for airplane-mode use.
- Current media controls use web Media Session; native Now Playing/remote-command integration and the required 30-minute background-device test remain outstanding.
- APNs end-to-end delivery/provisioning, cold/warm universal links, auth, playlists, Rooms, Studio, permissions and accessibility require completion/verification on the isolated lane and real device.
- Android signing fingerprint must be supplied/verified by the Play owner; do not invent it.
- No archive, upload, TestFlight install or final smoke test has been performed.

Overall status: **BLOCKED for TestFlight** pending verified isolated backend and completion of these runtime/device gates.
