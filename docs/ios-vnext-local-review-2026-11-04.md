# BVS iOS app — local visual and gesture review (4 November 2026)

Branch: `feat/ios-vnext-design-gestures-review-2026-11-04`
Base: `main` at `5f15894236c0f934871ddb7b3d9cd87f64f3a344`, which includes the November 3 web design work.
Status: **review only**. Do not merge or deploy without approval.

## Changes

- Native-contained iOS CSS only: flatter charcoal, lime BVS, lilac BeatStore and Feed, ice-blue Studio/Discover, poster-like typography and mostly square cards. Keep circular avatars and familiar playback controls.
- Header: current green BVS logo, 44-point Back button on detail pages, fallback to app Home for direct-entry routes.
- Five-tab role-aware navigation retained, with clearer selected states.
- Mini-player: tap artwork/title to expand; swipe up to expand; swipe left/right across artwork/title to skip next/previous. Transport controls, seeking slider and links are not gesture targets. Now Playing retains its separate full-screen handler.
- Feed: left/right swipe across noninteractive content to move between the available sections. Pull-to-refresh and tapping the segmented control still work. Horizontal media rails and iOS edge swipes are excluded.
- No modifications to music distribution clearance, playback authorization, app-store entitlements, native lock-screen transport, database or external-link security.

## Mac Mini handoff — use existing working copy

```bash
git fetch origin feat/ios-vnext-design-gestures-review-2026-11-04
git switch --track origin/feat/ios-vnext-design-gestures-review-2026-11-04
npm ci
npm run test:ios-visual-gesture-review
npm run test:ios-surface-gates
npm run typecheck
npm run dev
```

If the local branch already exists, use `git switch feat/ios-vnext-design-gestures-review-2026-11-04` instead. The browser preview is `http://localhost:3000/app/ios`, using the existing development environment configuration. No production deploy required.

## Manual QA

Check Home, Feed (Latest/Following/My Activity), Discover, Beats, Library, Creator Studio, artist/track details, mini-player, Now Playing, account and notifications at 375/390/430 px and tablet widths. Try normal taps, swipe up, horizontal player swipes, diagonal page scrolls, carousel scrolling, Feed pull-to-refresh, edge Back, and accessibility focus. Validate iPhone Safari/WKWebView before any native release.

Important: `capacitor.config.ts` still loads the production `https://bvsradio.com/app/ios` surface in the installed native binary. A local browser preview does not test native APNs, Dynamic Island, lock-screen controls or iOS status bar behavior.

## Interaction sources

Apple Human Interface Guidelines (Gestures): https://developer.apple.com/design/human-interface-guidelines/gestures
Spotify Now Playing: https://support.spotify.com/rw/article/now-playing/
Spotify Play Queue: https://support.spotify.com/sb/article/play-queue/
