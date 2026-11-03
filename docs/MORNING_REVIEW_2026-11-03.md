# BVS local review — 3 November 2026

Open **http://localhost:3100**. The running preview belongs to:

`/Users/abiaschivayo/Documents/Codex/2026-11-02/run-a-general-update-across-bvsradio/bvsradio-saiba`

This is the November checkout with the VS Code tasks, commerce work and newer player. The older Desktop checkout retains its original local edits; the improvements below live here. Nothing was deployed, pushed, purchased or submitted to a store. Existing uncommitted work was preserved.

## What to look at

- **Home listening room:** larger artwork, clear play state, next-track control, up-next preview, artwork failure fallback and visible playback errors. A native range control supports keyboard seeking. Frequent timeline updates no longer rerender the rest of this card. Signal, relationship fallbacks and the artist note are retained.
- **Weekly chart:** missing chart data produces discovery picks without invented ranks. Rotation pauses for hover, keyboard focus, manual selection, hidden tabs and reduced-motion preferences. A pause/resume button and larger slide targets make it controllable. Chart fetches are cancelled on unmount and have a deadline.
- **Audio-service offers:** selecting an offer changes it; a timer no longer changes a price or booking target while someone reads it. Existing catalogue references, prices, checkout and offer analytics are retained.
- **Content accuracy:** static picks say “Worth a listen,” rather than claiming weekly release dates. Artist biographies appear as descriptions rather than attributed quotes. Missing biographies no longer claim that an on-demand selection is in editorial rotation. Artist matching requires a real normalized name match.
- **Radio navigation:** scroll tracking picks up programme sections arriving behind Suspense, keeps track of all visible sections, and releases observers. Modified link clicks retain browser behavior.
- **Search:** the shared discovery hook has a 12-second request deadline, exposes the existing unavailable/retry state after a stall, and continues to reject stale query results. Unmount cleanup cancels both timers and network work.
- **Recovery/accessibility:** branded 404 and root-failure pages, app-aware route-error links, a skip-to-content link and visible keyboard outlines. The media-stage heading is now subordinate to the homepage heading.

## Verification

- Full `npm run build`: passed, including the existing release test chain and Next.js 16.4.4 production compilation.
- TypeScript and targeted ESLint: passed.
- `npm run test:listener-experience`: shared player actions, seek values, missing tracks, playback errors, streamed navigation, cleanup, web/iOS/Android recovery links, honest chart fallback, chart ranks and rotation controls.
- Discovery search tests: existing debounce, pagination and stale-response checks plus a new stalled-request recovery test.
- `node scripts/commerce-offer-tests.mjs`: passed visibility, attribution, cleanup and pending-payment regression checks.
- Local HTTP checks: `/` 200 with the new listening room and skip link; `/radio` 200; an unknown route 404 with the branded recovery text; homepage video HEAD 200.

The listener checks run in both build preflight scripts. The VS Code **BVS: verify changes** task now includes them, discovery and commerce verification.

## Limits of this review

Browser visual QA could not run: the Mac was locked and browser control was disabled. HTTP and component tests do not prove visual layout, actual audio output, device behavior or a successful checkout. Existing local configuration points at live services; no purchases, uploads, messages or database writes were made. Payment reconciliation, production email, background audio and native-device checks remain outside this local pass.

## Morning walkthrough

1. Open Home at wide and narrow widths. Try play, next, seek and queue; verify the artist/Signal content still feels balanced.
2. Hover or keyboard-focus the chart and select another slide. Check that it stays put while interacting.
3. Select each service offer and inspect its price and package link. Avoid submitting a real purchase during review.
4. Open Radio and scroll down to the streamed programme sections; check the shelf navigation.
5. Open an unknown URL and use the recovery links. Tab from the top to use “Skip to content.”

Use the existing **BVS: local preview** task to restart port 3100 if needed. Deployment remains your decision after review.
