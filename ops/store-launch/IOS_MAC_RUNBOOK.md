# iOS launch runbook — Mac only

**Priority:** iOS App Store / TestFlight first (per Abias full launch).  
**Play** next (AAB already on VPS).  
**Artist hub** (`artists.bvsradio.com`) after all store apps ship.

| | |
|--|--|
| App name | BVS Radio |
| Bundle ID | `com.bvsradio.app` |
| Developer (public) | Best Virtual Studios |
| Loads | https://bvsradio.com (Capacitor server.url) |
| Repo | `git@github.com:BasJunior/bvsradio-saiba.git` |

## 0. Accounts (Abias)

1. Enroll: https://developer.apple.com/programs/enroll/ ($99/yr)  
2. After active: https://appstoreconnect.apple.com/  
3. Note **Team ID** (Membership details) → send to agents for AASA  

## 1. Mac prerequisites

```bash
# Xcode 16+ from App Store, open once, accept license
xcode-select -p
# Node 20+
node -v
# GitHub SSH key that can clone BasJunior/bvsradio-saiba
```

## 2. Clone + sync

```bash
git clone git@github.com:BasJunior/bvsradio-saiba.git
cd bvsradio-saiba
git pull
npm ci
# Ensure out/ exists for cap webDir (hybrid still uses live URL)
mkdir -p out && echo '<!doctype html><title>BVS</title>' > out/index.html
npx cap sync ios
npx cap open ios
```

## 3. Xcode (first time)

1. Select target **App**  
2. **Signing & Capabilities**  
   - Team = your Apple Developer team  
   - Bundle Identifier = `com.bvsradio.app`  
   - Automatically manage signing  
3. Confirm **Background Modes → Audio** (Info.plist already has `UIBackgroundModes: audio`)  
4. Version: Marketing `1.0.0`, Build `1` (bump build every upload)  
5. Destination: **Any iOS Device (arm64)** for Archive  

## 4. Device test (your iPhone)

1. Plug iPhone, Trust computer  
2. Run (▶) on physical device  
3. Check: opens bvsradio.com, /radio plays, catalogue, login  

## 5. Archive → TestFlight

1. Product → **Archive**  
2. Organizer → **Distribute App** → App Store Connect → Upload  
3. App Store Connect → app **BVS Radio** (create if needed)  
4. Build appears under TestFlight (processing 5–30 min)  
5. Internal testing: add your Apple ID → install TestFlight app → install build  

## 6. App Store listing (while TestFlight processes)

| Field | Value |
|-------|--------|
| Name | BVS Radio |
| Subtitle | Best Virtual Sound |
| Category | Music |
| Privacy | https://bvsradio.com/privacy |
| Support | https://bvsradio.com/contact |
| Copyright | © Best Virtual Studios |
| Age | Complete questionnaire (music) |
| Screenshots | iPhone 6.7" required — capture from Simulator or device |

Draft copy: `ops/store-launch/listings/app-store-draft.md`

## 7. After first upload — message agents

Send:

```text
ios uploaded
Team ID: XXXXXXXXXX
```

Agents will set `public/.well-known/apple-app-site-association` and redeploy.

## 8. Submit for App Review

When TestFlight feels solid:

1. Select build  
2. Export compliance: **No** non-exempt encryption (ITSAppUsesNonExemptEncryption=false)  
3. Content rights: you own or have rights to streamed content  
4. Notes for reviewer: “Music radio web app; playback starts after user taps Play; account optional for library.”  
5. Submit  

## Quality gate (before public)

- [ ] Cold start loads site  
- [ ] Play works after tap; background audio after lock  
- [ ] No crash on rotate  
- [ ] Privacy + support URLs open  
- [ ] Checkout opens (web)  

## Then Play

AAB path: `ops/store-launch/builds/bvsradio-release.aab`  
Pay Play $25 → internal testing → production (see FULL_LAUNCH.md).

## Not in this phase

- `artists.bvsradio.com` Amuse-style hub (after all apps live)  
