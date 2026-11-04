# Native iOS product review — 4 November 2026

Local follow-up to `feat/ios-vnext-design-gestures-review-2026-11-04` at `c419cbd`.
Worktree: `bvsradio-ios-review-2026-11-04`; branch: `review/ios-vnext-local-2026-11-04`.
No merge, remote push, deployment, archive, TestFlight upload or device distribution.

## Changes made

- Adopt UIKit's scene lifecycle. The original app built but iOS 27 terminated it on launch with “UIScene life cycle is required.” The new scene delegate preserves the existing Capacitor window, app activation, audio/notification state and URL/user-activity forwarding.
- Align iOS Home with the web's content and copy: shared hero, Top 5/discovery, BVS Original, audio and creator offers, listening room, continue listening, artists/releases/producers, BeatStore, playlists, shows, Marketplace and community paths. Adapt links to stay inside the iOS shell, add an app album detail route, and send service offers into native Marketplace instead of web checkout. Keep Android's Home unchanged.
- Replace the empty iOS station's disabled transport with a discovery action and explanatory copy. Hide the empty mini-player while retaining player errors/notices and the full active-player component.
- Respect horizontal safe areas in the header, page content and Now Playing. The simulator's camera/status area covered the Join action before the header fix.
- Use one contained Back destination for the visible button and browser-preview edge swipe. Preserve discovery query/filter state on return and avoid adding Back entries for filter replacements.
- Align the iOS Beats tab with BeatStore's selected mode, including internal BeatStore navigation. Add transition feedback and a screen-reader status for pending iOS tab navigation.
- Match the iOS launch screen to the dark/lime product using the existing BVS vector logo. Generated splash PNGs are approximately 185 KB each, down from 2.4 MB each.
- Supply the missing default-avatar PNG and avoid caching reused development bundle URLs on localhost.
- Update the install prompt to use the approved lime BVS monogram, keep native browser install actions for Android/Chromium, and stop showing the outdated iPhone Safari Add to Home Screen hint. The web manifest already uses the same lime monogram.
- Bound station-library queries: six seconds for rotation/block checks and two seconds for optional video metadata. Keep mobile distribution-clearance filtering and fail-closed behavior.
- Synchronize CocoaPods to the Capacitor version already pinned in npm's lockfile.

## Repeatable simulator setup

Use the existing Capacitor and Xcode toolchain. No additional runtime/library was added.
Xcode 27's simulator display is Device Hub. Its required system components were updated locally from version 1174.9.2 to 1174.21.

```sh
npm ci
npm run dev -- --hostname 127.0.0.1 --webpack
# In a separate terminal, after starting an available simulator:
npm run ios:simulator-review -- <simulator-UDID>
# Optional contained direct-entry route:
npm run ios:simulator-review -- <simulator-UDID> /app/ios/studio
```

The launcher builds unsigned Debug simulator products, stages a separate copy under ignored `artifacts/ios-review/`, and gives it `com.bvsradio.app.review` / “BVS Review”. Only that staged product gets the localhost URL and local-network ATS setting. The tracked release URL remains `https://bvsradio.com/app/ios`. Do not archive or distribute the staged review product.

Review simulator created: `BVS Review iPhone`, UDID `7C183970-F083-48A2-B34C-BCFD40B5E443`, iPhone Duo, iOS 27.1. That installed runtime supports only iPhone Duo; the attempted iPhone 17 Pro configuration was incompatible. The original simulator's data was not erased.

The local Turbopack session repeatedly reloaded; webpack was stable. An earlier browser hydration warning referenced another checkout's cached client bundle, so it is not classified as a confirmed current native hydration defect.

## Verification

- Xcode Debug simulator build succeeded; installed and launched the review app. Native logs confirmed the local WebView loaded after the scene migration. The repeatable launcher also completed successfully.
- Visually inspected native Home, Feed, Discover, Library, Beats, signed-out Studio and signed-out Account. Navigated the five main tabs and switched Feed sections using their visible buttons. Account displayed the detail Back button; signed-in profile editing was not exercised.
- Verified the empty mini-player disappears, the header actions clear the camera area, and the Account heading wraps clear of the status area after the final content-inset change. The final Now Playing inset change still needs visual review with a playable track. A subsequent direct-entry Back tap was blocked by the Device Hub automation error `noWindowsAvailable`; its destination logic is covered by the navigation regression tests, not counted as a completed native interaction test.
- Avatar request returned HTTP 200.
- Station endpoint returned HTTP 200 with a fail-closed empty list in approximately 6.6 seconds during the upstream outage, versus an earlier approximately 90-second request.
- Automated: iOS visual/gesture assertions (including contained Back/filter cases), iOS surface gates, product maturity/playback/accessibility regressions, Home performance gates, media reliability/public-release access tests, TypeScript, and focused ESLint checks.
- Home parity follow-up: `npm run test:ios-visual-gesture-review`, `npm run test:ios-surface-gates` and `npm run typecheck` pass. Browser preview at 393 × 852 confirms the shared Home headline, discovery chart and app-contained destinations; live playback remains unavailable in the current data environment.
- Install prompt follow-up: focused lint/typecheck and iOS gates cover the Android/Chromium install affordance and iOS shell suppression; no native iOS install hint is shown on the public website.

## Remaining release blockers

1. The connected Supabase project's REST origin returned Cloudflare **522 connection timeouts** from the configured public anon key. Its management API reported a healthy project, but that does not verify the REST data path. The review checkout uses only the project's public URL/anon key; no service-role key was copied. The existing VS Code web server returned local API responses (8 beats, 51 artists, 21 producers and 6 releases), but those responses cannot be confirmed as fresh while the REST origin times out. Restore the public data path before evaluating live catalogue, playback or signed-in flows.
2. Native Feed drag attempts did not visibly switch sections using the automation input. Button switching works; real touch swipe behavior is **not verified**. Player swipes and continuity cannot be verified without playable, iOS-cleared tracks.
3. Review a signed-in listener and creator account, populated detail pages, Now Playing, final safe-area changes, larger text/VoiceOver, rotation and real iPhone/iPad layouts. This pass does not establish broad accessibility compliance.
4. Lock-screen/Control Center transport, audio interruptions/background recovery, APNs and notifications still need physical-device tests. A simulator launch is not release qualification.

Keep this branch local until those checks are complete and the owner approves any push or release action.
