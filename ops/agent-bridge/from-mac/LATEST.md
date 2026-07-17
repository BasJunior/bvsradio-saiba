# from-mac LATEST — 2026-07-17 (handoff to VPS)

**From:** Mac Grok (Grok Build) on Abias’s MacBook Pro  
**To:** VPS Saiba Codex / OpenClaw / any VPS agent  
**Human:** Abias Chivayo · Best Virtual Studios / BVS Radio  
**Repo path:** `/Users/abiaschivayo/Desktop/saibagrok/bvsradio-saiba` · `main` pushed  

---

## Executive status

**iOS is live on TestFlight Internal.** Abias confirmed the app experience is **all good** after a landing-page mobile text fix (web deploy).  

| Area | Status |
|------|--------|
| Capacitor iOS shell | Done (repo `ios/`, loads `https://bvsradio.com`) |
| Apple Developer | Paid · Team **Abias Chivayo** |
| **Team ID (for AASA)** | **`VGFK77VH73`** |
| Bundle ID | **`com.bvsradio.app`** (do not change) |
| App Store Connect app | **6792035284** — *BVS Radio* |
| Store listing name | **BVS Radio** |
| Subtitle | **Best Virtual Sound** |
| Build | **1.0 (1)** — processing state **VALID** · uploaded |
| TestFlight | **Internal** group · tester **abiasjnr@gmail.com** |
| Device QA | Abias: landing + app look good after web fix |
| App Review / public release | **Not submitted yet** (listing assets still open) |
| Play / artists hub | Out of Mac scope this phase (VPS) |

---

## What Mac completed (chronological)

1. **Environment** — Xcode 26.6 installed; license accepted; CocoaPods via user gem; `npx cap sync ios` green.  
2. **Signing** — Automatic · Development cert · device UDID registered · Team `VGFK77VH73`.  
3. **Simulator** — iPhone 17 build/run OK (Abias: looks good).  
4. **Archive** — `xcodebuild archive` succeeded → `build/BVSRadio.xcarchive` + IPA export.  
5. **ASC app record** — Created as “BVS Radio — Best Virtual Sound”, then **renamed** listing to **BVS Radio** + subtitle to stop TestFlight title cutoff.  
6. **Upload** — Binary uploaded to App Store Connect (logs: *Upload succeeded* / *Uploaded to Apple*).  
7. **TestFlight API** — Used ASC API key (local `AuthKey_*.p8`, **not in git**):  
   - Group **Internal** (`92c64256-826a-4499-8f84-8f7ad151327b`)  
   - Build **1** assigned  
   - Tester **abiasjnr@gmail.com** invited + linked  
8. **Web fix (home only)** — Mobile hero text was clipping in Capacitor WebView; fixed responsive type + overflow; pushed `main` → Vercel (`e2c0ba2` era). Abias: **all good**.  

---

## Facts VPS should use

```text
Team ID:          VGFK77VH73
Bundle ID:        com.bvsradio.app
AASA appID:       VGFK77VH73.com.bvsradio.app
ASC App ID:       6792035284
SKU:              com.bvsradio.app
Primary locale:   en-GB
Store URL stub:   https://apps.apple.com/app/id6792035284
Privacy:          https://bvsradio.com/privacy
Support:          https://bvsradio.com/contact
Marketing:        https://bvsradio.com
Content URL:      https://bvsradio.com  (hybrid shell)
Stream/domain:    bvsradio.com + *.bvsradio.com
```

### Suggested `apple-app-site-association` appID entry

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appIDs": ["VGFK77VH73.com.bvsradio.app"],
        "paths": ["*"]
      }
    ]
  }
}
```

(Adjust paths if you only want specific deep links.)

---

## Mac remaining (not blocking VPS AASA)

| Task | Owner | Notes |
|------|--------|--------|
| App Store screenshots (6.5") | Abias / Mac | Ready folder: `ops/store-launch/assets/screenshots/app-store-6.5/` |
| Listing copy | Abias / Mac | Draft: `ops/store-launch/listings/ASC-FILL-NOW.md` |
| App Privacy questionnaire | Abias | Policy URL ready |
| Age rating / pricing | Abias | Music category |
| **Submit for Review** | Abias when ready | Build 1 can be attached |
| Next native binary | Mac | Bump `CURRENT_PROJECT_VERSION` only if Info.plist / native changes |

**No native resubmit needed** for pure web fixes — content ships with Vercel deploys.

---

## VPS asks (priority)

1. **AASA** — write `public/.well-known/apple-app-site-association` with **`VGFK77VH73.com.bvsradio.app`**, deploy, verify HTTPS content-type.  
2. **Play** — continue Android Console device verify + AAB (`ops/store-launch/builds/bvsradio-release.aab`) when ready.  
3. **Artists hub** — still **deferred** until stores are public.  

---

## Do not

- Change bundle ID  
- Start `artists.bvsradio.com` / Amuse clone this phase  
- Commit ASC `.p8` keys or secrets  
- Treat standalone `Desktop/saibagrok/bvsradio-ios` as production (canonical = this repo `ios/`)  

---

## Local Mac paths (reference)

```
Repo:     ~/Desktop/saibagrok/bvsradio-saiba
Archive:  ~/Library/Developer/Xcode/Archives/2026-07-17/BVSRadio*.xcarchive
IPA:      build/export/BVSRadio.ipa
ASC key:  ~/Desktop/saibagrok/AuthKey_*.p8  (local only, gitignored)
```

---

**Phase:** iOS TestFlight **validated by human** · **Team ID delivered** · VPS AASA + Play · App Review when listing complete  

**Ack requested:** VPS updates `from-vps/LATEST.md` after AASA deploy with public AASA URL check result.  
