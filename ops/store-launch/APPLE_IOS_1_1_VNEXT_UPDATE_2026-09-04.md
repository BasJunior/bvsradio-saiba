# BVS Radio iOS 1.1 — App Store update (vNext)

**Date:** 2026-09-04  
**Bundle:** `com.bvsradio.app`  
**Version:** **1.1 (4)**  
**Minimum iOS:** **15.0** (ITMS-90068)  
**Current live:** 1.0 (3) Ready for Sale  

## What this update is

The existing listing stays **BVS Radio**. This is not a new app.

1.1 is the deliberate native release of the vNext app shell:

- Five-tab chrome: Home, Explore, Library, Create/Studio, You
- Native share, network, preferences, push registration, rights-gated offline downloads
- Contained join, support, notifications, marketplace browse, and creator studio
- Production URL remains `https://bvsradio.com/app/ios`

## What this is not

- Not a dump of the isolated vNext preview (`bvsradio-app-vnext-2026-09.vercel.app`)
- Not a beta-backend App Store binary
- Not a silent feature injection into 1.0 (3)

The 1.1 chrome is **version-gated**. Installed 1.0.3 binaries keep the approved listener shell. Native 1.1+ and `?appShell=vnext` preview see the new chrome.

## Rights / review lock

- iOS music stays fail-closed on `mobile_distribution_clearances` status=`cleared`
- Beat licences still open the website outside the native shell
- Song Workspace / Lyrics Pad stay out of the iOS shell
- Rooms exist as contained routes, not a primary tab

## Mac archive (required)

This VPS cannot sign/upload. Abias's Mac (`abiass-macbook-pro`) is on Tailscale but SSH port 22 is closed.

```bash
git fetch origin saiba/appstore-vnext-1-1-2026-09-04
git checkout saiba/appstore-vnext-1-1-2026-09-04
npm ci
mkdir -p out && echo '<!doctype html><title>BVS</title>' > out/index.html
npx cap sync ios
open ios/App/App.xcworkspace
```

Xcode: Team `VGFK77VH73`, bundle `com.bvsradio.app`, version **1.1**, build **4**, Any iOS Device. Archive → App Store Connect → TestFlight. Then submit 1.1 for review.

## What's New (listing paste)

Listen, follow and create in one BVS Radio update. New Create and You tabs, native sharing and notifications, and rights-cleared offline downloads. Requires iOS 15.

## Review notes (paste)

BVS Radio 1.1 keeps the approved BVS-controlled listen surface. Only tracks with BVS iOS clearance appear in the player. New Create/You tabs are first-party BVS workflows for the same account. Beat licences and website checkout open outside the app. Demo account is the existing App Review listener. Playback starts after the user taps Play.
