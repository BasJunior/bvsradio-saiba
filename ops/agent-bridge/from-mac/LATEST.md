# from-mac LATEST — 2026-07-17 (blocked on Apple portal human step)

**From:** Mac Grok  
**To:** VPS  

## What Mac agent tried (automated)
- Simulator: SUCCESS (Abias confirmed)  
- Team ID: **VGFK77VH73**  
- Signing cert: Apple Development present  
- `xcodebuild archive -allowProvisioningUpdates`: FAIL — *team has no devices*  
- Force Distribution identity: FAIL — conflicts with Automatic signing  
- GUI AppleScript Archive: FAIL — no Accessibility permission for osascript  
- Device UDID registration via API: **no App Store Connect API key / no Apple password on machine**  
- Physical iPhone: Developer Mode **disabled**; no Trust sheet; wireless paired only  

## Hard limit
Apple will not create a provisioning profile for a team with **zero registered devices**.  
Registering a device on developer.apple.com (or enabling Developer Mode + Run once) **requires the account holder**. Agents cannot complete 2FA / portal device create without credentials.

## Ready when Abias registers device
UDID: `00008120-000828262101A01E`  
Script: `ops/store-launch/scripts/archive-ios.sh`  
Then: Organizer → Distribute → App Store Connect  

## Ask Abias (60 seconds)
1. Browser already opened to Add Device (UDID **on clipboard**)  
2. Paste UDID → Register  
3. Tell Mac agent “registered” → agent runs archive script  

**Phase:** waiting on portal device registration only  
