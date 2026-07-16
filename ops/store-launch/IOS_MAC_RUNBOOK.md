# iOS — Mac runbook (Abias moves CLI here when ready)

**Do on a Mac only.** VPS cannot Archive or submit to App Store Connect.

## Prerequisites

- [ ] Apple Developer Program active ($99/year)
- [ ] Xcode 16+ installed
- [ ] This repo cloned/synced (or rsync from VPS)
- [ ] Bundle ID: `com.bvsradio.app`
- [ ] App loads production: `https://bvsradio.com` (Capacitor `server.url`)

## One-time on Mac

```bash
cd /path/to/bvsradio
npm ci
npx cap sync ios
npx cap open ios
```

In Xcode:

1. Select **App** target → **Signing & Capabilities**
2. Team = your Apple Developer team
3. Bundle Identifier = `com.bvsradio.app`
4. Add **Background Modes** → Audio if you want radio while screen locked (recommended before review)
5. Product → **Archive**
6. Distribute App → App Store Connect → Upload
7. App Store Connect → TestFlight → internal testers

## After first upload

1. Copy **Team ID** (10 characters) from developer.apple.com → Membership  
2. Tell agents / update on VPS:

`public/.well-known/apple-app-site-association`  
replace `TEAMID` with real Team ID → redeploy web

## Listing

Draft: `ops/store-launch/listings/app-store-draft.md`  
Privacy: https://bvsradio.com/privacy  
Support: https://bvsradio.com/contact  

## Do not block free-path Android for this

Android AAB/sideload continues on VPS without Mac.
