# vNext player/navigation overlap fix — 2026-09-03

Scope: `saiba/app-vnext-2026-09`, isolated beta-backed device site only.

## Report and cause

Abias's physical-iPhone screenshot shows the shared Radio screen's mini player covering the icons in the bottom navigation. The shared player used `bottom-16` (64px), but the tab bar includes 64px of controls plus safe-area padding and a border. App routes also rendered a second legacy header beneath AppTopBar. Fixed main-content padding did not follow growing player notices.

## Fix

- One shared CSS geometry model for the header, tab bar, mini player, content, queue and Ask BVS.
- React callback refs measure full border-box heights with ResizeObserver, including safe-area padding and wrapped notices. Watching only the content box would miss padding-only changes; the regression test covers this explicitly.
- Player bottom equals the actual tab-bar height. Main content and scroll padding reserve the combined player/tab height plus a shared gap.
- Top and horizontal safe areas are respected. The app header is exclusive on app routes; the existing listener-style header remains on shared routes reached from an app session.
- Website promo is suppressed on app routes; shared Radio retains it below the measured header.
- No playback/queue state, rights catalogue, backend, native identity, security or signing changes.
- Local native build output excluded from deployment uploads.

## Verification

- TypeScript and production webpack build: PASS.
- App-link routing, native isolation and native source-contract tests: PASS.
- `npm run test:chrome-layout`: PASS (padding-aware observer, rotation size, hidden desktop nav, growing notices, cleanup).
- Clean focused lint for new measurement and directly changed shell files. Existing StationPlayer lint remains 10 errors/1 warning; PremiumInstantPromoBanner remains 1 error, confirmed unchanged against HEAD before this fix.
- Automated Chromium geometry/hit tests on local production build: app Home and shared Radio at 393×852 with simulated 59px top / 34px bottom safe areas: PASS. Navigation 99px; player 77px; player bottom and nav top both 753px. All tab hit targets unobstructed and at least 44px high.
- Tall synthetic player notice: PASS; player grows to 181px, navigation stays unobstructed, main padding follows.
- Landscape app Home at 852×393 with simulated side/bottom safe areas: PASS. Navigation 86px, player 85px; shared boundary 307px.
- Signup at 393×460 (shortened viewport, not a real software keyboard): PASS. Meaningful UI, no browser exceptions reported.

Browser assertion helper: `scripts/chrome-layout-browser-check.js` (feed to agent-browser eval --stdin).
Local screenshots and build log: ignored `output/vnext-native/layout-*.png` and `chrome-production-build.log`.

## Evidence limits

These are browser layout measurements with simulated safe-area values, not a fresh iOS Simulator or physical-device acceptance result. Abias supplied the before screenshot; the corrected phone UI still needs his confirmation after the isolated web deployment is refreshed. No new native archive, TestFlight or App Store upload is required for this web-layout-only patch, and none was performed for it.
