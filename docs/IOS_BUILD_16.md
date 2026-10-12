# BVS Radio iOS build 16 handoff

The Capacitor shell loads `https://bvsradio.com/app/ios`, so the current mobile web routes for listening, discovery, Feed, library, BeatStore, Marketplace, Creator Studio and the notifications inbox are already available inside the iOS app. The new binary is needed for native push bridge reliability and signing; website content updates do not require another binary.

## Changes in this build

- Version `1.4` (build `16`). Apple rejected the original `1.3` archive because that release train was already closed.
- Debug and Release explicitly select the Apple Push entitlement for the correct APNs environment. The minimum deployment target is iOS 15 to build with Xcode 27, including CocoaPods targets.
- The native WebView bridge retries installation during startup. Notification settings refresh once it becomes available, so an early page load does not leave the enable button stuck as unavailable.

## Verification on this Mac

- `npm run test:ios-surface-gates`, `node scripts/notification-reliability-tests.mjs`, `npm run typecheck`, and targeted ESLint passed.
- An unsigned iPhoneOS Release build compiled and reported `CFBundleVersion=16`.
- Xcode archived version `1.4` build `16` at `/private/tmp/BVSRadio-1.4-build16.xcarchive` and exported `/private/tmp/BVSRadio-1.4-build16-export/App.ipa` with cloud-managed Apple Distribution signing. `codesign --verify --deep --strict` passed, and the signed app reports `aps-environment=production`.
- Xcode Organizer reported **App upload complete** for `1.4 (16)` on 11 October 2026. App Store Connect → TestFlight → Build Uploads showed `1.4 (16)` as **Complete** at 2:48 PM. The processed build appeared under Version 1.4 as **Ready to Submit** and was assigned to the existing **Internal** testing group.

## Finish TestFlight and device verification

1. Confirm the existing Internal group contains the intended testers and that they can install `1.4 (16)` from TestFlight.
2. Confirm production has APNs provider credentials and the `/api/app/push/register` status reports `iosDeliveryReady: true` for a signed-in test account. A ready flag alone does not prove delivery.
3. On a physical iPhone with build 16, sign in, enable lock-screen alerts in **You → Notifications**, and verify a community notification arrives with the app backgrounded and when locked. Tap it after a cold start and confirm it opens the intended BVS screen. Also check foreground inbox refresh, quiet hours, and sign-out unregistration. This Mac currently detects only an iPad, so the iPhone check needs an iPhone connected or a TestFlight installation on one.

APNs provider acceptance, a local archive, and an unsigned compile do not establish that an iPhone displayed a notification.
