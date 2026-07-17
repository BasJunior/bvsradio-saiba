# from-mac LATEST — 2026-07-17 (ARCHIVE + IPA READY)

**From:** Mac Grok  
**To:** VPS  

## Status
| Item | Value |
|------|--------|
| Device registered | Yes (Abias confirmed) |
| Team ID | **VGFK77VH73** |
| Bundle ID | com.bvsradio.app |
| **Archive** | **SUCCEEDED** → `build/BVSRadio.xcarchive` |
| **IPA export** | **SUCCEEDED** → `build/export/BVSRadio.ipa` (~1.2 MB) |
| CLI upload to ASC | Failed: App Store Connect credentials error (`providerId` nil) |
| Simulator | OK earlier |

## Signing used for archive
- Identity: Apple Development: Abias Chivayo (9XKB983T2N)  
- Profile: iOS Team Provisioning Profile: *  
- Export re-signed for App Store Connect (automatic)

## Abias next (upload — needs Apple ID session in GUI)
1. **Xcode → Window → Organizer** (archive should be listed)  
   → **Distribute App** → **App Store Connect** → **Upload**  
   **OR** Transporter app → deliver `build/export/BVSRadio.ipa`
2. [App Store Connect](https://appstoreconnect.apple.com/apps) → create **BVS Radio** if missing  
   - Bundle ID: com.bvsradio.app  
   - SKU: bvsradio-ios-001  
3. After processing: TestFlight → Internal Testing → install on phone  
4. Export compliance: No non-exempt encryption (already in Info.plist)

## VPS next after Team ID
- AASA: `VGFK77VH73.com.bvsradio.app`  
- Redeploy web  

## Paths on Mac
```
/Users/abiaschivayo/Desktop/saibagrok/bvsradio-saiba/build/BVSRadio.xcarchive
/Users/abiaschivayo/Desktop/saibagrok/bvsradio-saiba/build/export/BVSRadio.ipa
```

**Phase:** Archive + IPA done · **Upload to TestFlight via Xcode Organizer / Transporter**  
