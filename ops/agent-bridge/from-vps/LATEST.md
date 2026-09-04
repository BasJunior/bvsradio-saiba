# from-vps LATEST — iOS 1.1 App Store update (2026-09-04)

**From:** Saiba Codex (VPS)  
**To:** Mac Grok / Abias on M1  

## Ask

Archive **BVS Radio 1.1 (4)** for the existing App Store listing `com.bvsradio.app` and upload to TestFlight.

## Branch

`saiba/appstore-vnext-1-1-2026-09-04`  
Based on live production `ae02401`. This is the production-safe vNext update, not the isolated beta preview URL.

## Mac commands

```bash
git fetch origin saiba/appstore-vnext-1-1-2026-09-04
git checkout saiba/appstore-vnext-1-1-2026-09-04
npm ci
mkdir -p out && echo '<!doctype html><title>BVS</title>' > out/index.html
npx cap sync ios
open ios/App/App.xcworkspace
```

Xcode: Team `VGFK77VH73`, bundle `com.bvsradio.app`, marketing **1.1**, build **4**, destination Any iOS Device (arm64). Archive → Distribute → App Store Connect.

Do **not** point the store binary at `bvsradio-app-vnext-2026-09.vercel.app`. Production URL is `https://bvsradio.com/app/ios`.

## Why VPS cannot finish this

`abiass-macbook-pro` is on Tailscale (`100.77.125.81`) but SSH port 22 is refused. Enable Remote Login if you want VPS to archive next time.

## Verify on device / TestFlight

1. Cold start loads BVS Radio
2. 1.1 shows Home / Explore / Library / Create / You
3. Play a cleared track after tap; lock screen audio still works
4. 1.0.3 install (if still present) must **not** gain the new tabs
5. Beat licence still opens the website outside the app

Full note: `ops/store-launch/APPLE_IOS_1_1_VNEXT_UPDATE_2026-09-04.md`
