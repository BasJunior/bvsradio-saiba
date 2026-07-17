# BVS Radio — Full market launch plan

**Goal:** Quality, complete presence on **web + PWA + Play + App Store**, commerce ready.  
**App ID:** `com.bvsradio.app` · Loads production `https://bvsradio.com`  
**Repo:** `git@github.com:BasJunior/bvsradio-saiba.git`

## Priority order (locked with Abias 2026-07-16)

1. **iOS** App Store / TestFlight (Mac)  
2. **Play** Android (AAB ready; pay + upload)  
3. **All apps public**  
4. **Then** `artists.bvsradio.com` free/paid tier + DSP (Amuse-like) — design parked, not blocking  

## Parallel tracks

| Track | Where | Status | Owner |
|-------|--------|--------|--------|
| **A. Web/PWA** | Vercel | Live | Agents continuous |
| **B. iOS App Store** | **Mac required** | Info.plist + audio session prepped | Abias Mac + $99 |
| **C. Android Play** | VPS AAB ready | AAB built | Abias pay → upload |
| **D. Commerce files** | Drive → VPS products | Listings live, zips blocked | Abias share/drop files |
| **E. Artist hub** | After stores | Spec only | Post-launch |
| **F. Ops** | Paynow/Stripe/SMTP | Partial | Abias keys + dashboards |

## Phase 1 — Accounts (Abias, this week)

1. **Google Play** — $25 one-time  
   https://play.google.com/console/signup  
2. **Apple Developer Program** — $99/year  
   https://developer.apple.com/programs/enroll/  
3. After Apple: open https://appstoreconnect.apple.com/

Do **both enrollments in parallel** (Apple can take hours–days to approve).

## Phase 2 — Android (can finish without Mac)

Artifacts already on VPS:

- `ops/store-launch/builds/bvsradio-release.aab` (signed, upload)
- `ops/store-launch/builds/bvsradio-debug.apk` (sideload QA)

Steps:

1. Create app `com.bvsradio.app` in Play Console  
2. Upload AAB → **Internal testing**  
3. Fill listing (copy in `listings/play-store-draft.md`, feature graphic in `assets/`)  
4. Content rating: `listings/CONTENT_RATING_ANSWERS.md`  
5. Copy **Play App Signing SHA-256** → agents update `assetlinks.json`  
6. Promote Internal → Production when QA ok  

## Phase 3 — iOS on Mac (Abias opens session on Mac)

### Mac machine checklist

- [ ] macOS + Xcode 16+  
- [ ] Apple ID logged into Xcode with **paid** Developer team  
- [ ] Node 20+ + git  
- [ ] Repo cloned: `git clone git@github.com:BasJunior/bvsradio-saiba.git`  
- [ ] `cd bvsradio-saiba && npm ci && npx cap sync ios && npx cap open ios`

### Xcode

1. Signing: Team + bundle `com.bvsradio.app`  
2. Background Modes → Audio (radio while locked)  
3. Product → Archive → Upload to App Store Connect  
4. TestFlight → internal testers  
5. Send **Team ID** to agents → fix AASA on web  

Detail: `IOS_MAC_RUNBOOK.md`

### Quality bar (iOS + Android)

- Cold start to player < few seconds on mid-range device  
- Play requires user gesture (policy)  
- Checkout stays on web (avoid IAP fights for digital goods v1)  
- Privacy + support URLs live  
- Screenshots: phone + tablet where required  

## Phase 4 — Commerce (same week as stores)

| Item | Action |
|------|--------|
| LORD + 16 Bit albums | Already on catalogue (ids 100, 101) |
| Delivery zips | Share Drive “anyone with link” OR drop `bvsradio-products/albums/100.zip` + `101.zip` |
| Real LORD cover | Same for PNG → replace placeholder |
| Paynow EcoCash | Integration ID/Key on Vercel |
| Stripe | Already in production env if keys set |
| Supabase SMTP | Dashboard → IONOS contact@ |

## Phase 5 — Public launch day

1. Play production approved  
2. App Store review approved (or soft-launch TestFlight first)  
3. Homepage + social: install links (Play + App Store + PWA)  
4. Catalogue albums purchasable with real delivery  
5. Telegram/ops alerts for orders  

## Quality over speed — still timely

- **Do not** ship unsigned or unreviewed store builds  
- **Do** ship internal tracks early for real-device QA  
- **Do** keep web/PWA shipping daily (store shells load live site)  
- Content updates = web deploy, not store resubmit  

## What Abias says next

| Message | What we do |
|---------|------------|
| `play account ready` | Guide AAB upload + listing |
| `on mac now` | Full Capacitor iOS Archive path |
| `drive shared` / files on VPS | Import zips + real cover + re-verify catalogue |
| `full launch week` | Daily checklist + Telegram blockers only |
