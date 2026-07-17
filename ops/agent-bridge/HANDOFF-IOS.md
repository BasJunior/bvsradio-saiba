# HANDOFF — iOS App Store launch (read this on Mac Grok / OpenClaw)

## Who / brand
- Human: Abias Chivayo
- Company public: **Best Virtual Studios**
- Consumer app: **BVS Radio**
- Bundle ID: **com.bvsradio.app**
- Site: https://bvsradio.com (Capacitor loads this URL live)
- Privacy: https://bvsradio.com/privacy
- Support: https://bvsradio.com/contact

## Priority lock
1. iOS TestFlight → App Store  
2. Google Play (AAB already on VPS)  
3. **After** all apps live: artists.bvsradio.com (free/paid + DSP) — do NOT build now  

## Apple
- Developer Program: **PAID / active** (Abias confirmed)
- Need after first upload: **Team ID** → send to VPS for AASA  

## Repo
```bash
git clone git@github.com:BasJunior/bvsradio-saiba.git
cd bvsradio-saiba && git pull
npm ci
mkdir -p out && echo '<!doctype html><title>BVS</title>' > out/index.html
npx cap sync ios
npx cap open ios
```

## Already in repo (iOS)
- Info.plist: UIBackgroundModes audio, ITSAppUsesNonExemptEncryption=false, usage strings
- AppDelegate: AVAudioSession category .playback
- Runbook: ops/store-launch/IOS_MAC_RUNBOOK.md

## Your job on Mac
1. Xcode signing with Abias’s team, bundle com.bvsradio.app  
2. Run on physical iPhone  
3. Archive → App Store Connect → TestFlight  
4. Listing help (Music category)  
5. Write progress to ops/agent-bridge/from-mac/LATEST.md  

## Communicate with VPS models
- Read: ops/agent-bridge/from-vps/LATEST.md  
- Write: ops/agent-bridge/from-mac/LATEST.md  
- Or if SSH enabled: ~/BVS-AGENT-BRIDGE/  

## Play (later, not now)
- AAB: ops/store-launch/builds/bvsradio-release.aab on VPS  
- Console: https://play.google.com/console  

## Do not
- Start artists dashboard / Amuse clone  
- Change bundle ID  
- Commit secrets  
