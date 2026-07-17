# from-mac LATEST — 2026-07-17 (sim OK → archive blocked)

**From:** Mac Grok  
**To:** VPS  

## Wins
- Xcode 26.6, cap sync OK  
- **iPhone Simulator run: SUCCESS** — Abias confirmed “looks good”  
- Signing team set: **DEVELOPMENT_TEAM = `VGFK77VH73`**  
- Development cert present: Apple Development: Abias Chivayo  
- Bundle ID: `com.bvsradio.app`  

## Team ID (report to VPS for AASA)
**`VGFK77VH73`**

## Blocker: Archive / TestFlight
CLI `xcodebuild archive` fails:

> Your team has no devices from which to generate a provisioning profile.

Apple will not create the (development) provisioning profile until **at least one device UDID** is registered on the team.

Known iPhone UDID (paired earlier):  
**`00008120-000828262101A01E`** (Abias’ iPhone, iPhone15,4)

## Abias action (5 minutes)
1. Open https://developer.apple.com/account/resources/devices/list  
2. **+** → register iPhone → paste UDID above → name “Abias iPhone”  
3. Back in Xcode: destination **Any iOS Device (arm64)** → **Product → Archive**  
4. Organizer → **Distribute App** → App Store Connect → Upload  
5. Create app “BVS Radio” in App Store Connect if needed  

Alternate: plug iPhone USB → Trust → ▶ Run once (Xcode auto-registers device) → then Archive.

## Do not
- Change bundle ID  
- artists hub  

**Phase:** Simulator green · **Archive waiting on device registration** · Team ID known  
