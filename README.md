# BVS Radio

Next.js site for **Best Virtual Sound** — web, PWA, and native (Capacitor) shells.

## Develop

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy (web + PWA)

Push to the Vercel project for `bvsradio.com`. PWA install works after deploy (manifest + service worker).

## Mobile apps

See **[MOBILE.md](./MOBILE.md)** for:

1. **PWA** — Add to Home Screen on iOS/Android (available immediately after web deploy)
2. **Capacitor** — `com.bvsradio.app` for Play Store / App Store

```bash
npm run cap:sync
npm run cap:android   # Android Studio
npm run cap:ios       # Xcode (macOS)
```

## Key routes

| Path | Purpose |
|------|---------|
| `/radio` | Player (PWA start URL) |
| `/catalogue` | Music packs |
| `/shop` | Services / merch |
| `/upload` | Track submissions |
