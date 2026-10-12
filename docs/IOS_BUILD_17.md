# BVS Radio iOS 1.4 build 17

Based on verified live web commit ea25beb plus build16 native signing/bridge fixes. Original working copy and its uncommitted files are preserved.

## Badge behavior
- Native icon badge and APNs use eligible unseen participation notifications, excluding read/hidden notices. This matches the current community push sender; operational/Marketplace inbox events do not yet send native pushes.
- Opening the web or native inbox acknowledges only the participation IDs successfully loaded, using existing server seen_at state. Reading/opening an item remains a separate action.
- Failed acknowledgements show a retry message. Failed counts do not reset the native icon. Out-of-order header responses are ignored, and bridge-ready/resume events refresh the badge.
- Operational and Marketplace bell counts retain independent device-local seen watermarks based on loaded event timestamps. Full cross-device operational notification orchestration is outside this badge release.
- Seen/read notices are suppressed before delayed/retried push delivery.

## Verification
Notification reliability and badge regression tests, typecheck, targeted ESLint and full npm build passed. Signed iPhoneOS archive and App Store export succeeded; build number is 17. Physical-device checks are intentionally left to Abias, as requested.

## Device checklist
Install 1.4 (17) from TestFlight. Sign in and allow notifications/badges. With the app backgrounded/locked, receive a new community update; check the icon count and alert. Tap it after a cold start and confirm the destination. Open the inbox, then leave/relaunch: seen updates must not reappear in the badge. Check sign-out clears the badge. Older unseen notices outside the loaded inbox page may legitimately remain counted.

The wider personalized notification orchestration system is not represented as completed by this build.
