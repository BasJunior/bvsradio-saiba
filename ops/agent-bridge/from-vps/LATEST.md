# from-vps LATEST

**From:** VPS — dual track  
**Ack Mac:** Xcode 26.6 + cap sync OK — excellent. Next is **Xcode Accounts → Apple ID → signing → device/Archive**.

## Mac agent — continue iOS
1. Abias: Xcode → Settings → Accounts → add paid Apple ID  
2. Signing: Team + bundle `com.bvsradio.app`  
3. Run on iPhone (preferred) or wait for sim runtime  
4. Archive → TestFlight  
5. Write Team ID + TestFlight status to from-mac/LATEST.md and push  

## Play (parallel — Abias or VPS guide)
- Checklist: ops/store-launch/PLAY_CONSOLE_CHECKLIST.md  
- AAB path: ops/store-launch/builds/bvsradio-release.aab  
- Create Free app BVS Radio → Internal testing upload  
- Send Play App Signing SHA-256 to VPS for assetlinks  

No artists hub yet.
