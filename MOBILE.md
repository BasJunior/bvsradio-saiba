# BVS Radio — Mobile (iOS + Android)

Two layers. Use **both**: PWA now for every phone; Capacitor when you want App Store / Play Store icons.

```text
Phone users today     →  PWA “Add to Home Screen” (works after Vercel deploy)
Store listing later   →  Capacitor shell (com.bvsradio.app) → Play / App Store
```

## 1. Progressive Web App (live with the website)

Already wired in this repo:

- `public/manifest.webmanifest`
- `public/sw.js` (shell cache only — **does not** cache large MP3s)
- Install banner (`PwaRegister`)
- Apple touch icon + theme color

### User install

| Platform | How |
|----------|-----|
| **Android Chrome** | Open [bvsradio.com/radio](https://bvsradio.com/radio) → banner **Install app**, or menu → Install app |
| **iPhone Safari** | Share → **Add to Home Screen** (iOS never shows a Chrome-style install prompt) |
| **Desktop** | Chrome/Edge install icon in the address bar |

After Vercel deploy, verify:

1. `https://bvsradio.com/manifest.webmanifest` returns JSON  
2. DevTools → Application → Service Workers → `/sw.js` active  
3. Lighthouse → PWA section (installable)

## 2. Native shells (Capacitor)

Config: `capacitor.config.ts`  
App ID: `com.bvsradio.app`  
Mode: **loads https://bvsradio.com** so catalogue/player updates ship with web deploys (no store resubmit for content).

### One-time setup (dev machine)

```bash
cd ~/.openclaw/workspace/bvsradio
npm install
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios @capacitor/splash-screen @capacitor/status-bar @capacitor/app
npx cap add android   # needs Android Studio / SDK
npx cap add ios       # needs macOS + Xcode
npm run cap:sync
```

### Android (Play Store)

```bash
npm run cap:android
# Android Studio: Build → Generate Signed Bundle / APK
# Upload AAB to Google Play Console
```

Then put the **Play App Signing SHA-256** into:

`public/.well-known/assetlinks.json` → replace `REPLACE_WITH_PLAY_APP_SIGNING_SHA256`

Redeploy the website so Digital Asset Links work (App Links / TWA).

### iOS (App Store)

```bash
# On a Mac:
npm run cap:ios
# Xcode: set Team, bundle id com.bvsradio.app, signing
# Archive → Upload to App Store Connect
```

Replace `TEAMID` in `public/.well-known/apple-app-site-association` with your Apple Team ID, then redeploy web.

### Store checklist (both)

- [ ] Screenshots: phone 6.7" + tablet  
- [ ] Privacy policy URL: `https://bvsradio.com/privacy`  
- [ ] Support URL: `https://bvsradio.com/contact`  
- [ ] Age rating: music (no user-generated chat risk if assistant is FAQ-only)  
- [ ] Audio plays only after user taps Play (already the case)  
- [ ] Background audio: improve later with Capacitor audio plugins if needed  

## 3. npm scripts

| Script | Purpose |
|--------|---------|
| `npm run build` | Next.js production build |
| `npm run cap:sync` | Sync Capacitor config |
| `npm run cap:android` | Open Android Studio project |
| `npm run cap:ios` | Open Xcode project |

## 4. What this is *not*

- Not a full React Native rewrite — same UI as the website, faster path.  
- Not offline full catalogue download (by design; saves storage and rights issues).  
- iOS still needs a **Mac** for the final App Store build (or a CI Mac runner / EAS-like service later).

## 5. Recommended rollout

1. **This week:** deploy PWA to Vercel → share “install BVS” link  
2. **Next:** build Android AAB, internal testing track  
3. **Then:** iOS TestFlight  
4. **Public** store listings once screenshots + privacy copy are ready  
