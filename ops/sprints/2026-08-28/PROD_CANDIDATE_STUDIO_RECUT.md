# Candidate 01 recut — intent-first Creator Studio

**Status:** READY — OWNER APPROVAL REQUIRED  
**Branch:** `saiba/prod-candidate-studio-recut-2026-08-28`  
**Base:** live production `eb80df4` / `origin/production/current`  
**Old branch:** `saiba/prod-candidate-studio-intent-2026-08-28` @ `ba9dd2e6` — **OBSOLETE — DO NOT PROMOTE** (cut from GitHub `main`, not live prod).

## What this recut did

Ported Studio **intent**, not the old files, onto current production Studio:

- Front door `/creator/studio`: Release music / Sell a beat / Offer a service
- Full Studio moved to `/creator/studio/manage` (current production page, not the stale main copy)
- Money still `/artists` (live wallet)
- Service categories include `recording` and `studio_session`
- Legacy hashes redirect to `/manage#…`
- Studio does not mount into `/app/ios`
- Mobile: 44px tap targets, 16px inputs, overflow hidden on release form
- Analytics allowlist + `studio_open` / create funnel events
- `vercel-build` runs `test:studio-intent` first

No DB migration. No native/Capacitor change. No Lyrics Pad in this slice.

## Approval

`C01_STUDIO_PRODUCTION_APPROVED` must be **YES** and production must still be the recorded live SHA (or C03’s new SHA after that promote). Recut again if production moves first.
