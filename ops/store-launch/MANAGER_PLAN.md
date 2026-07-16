# Manager plan — BVS store free path

**Orchestrator:** session `bvs-store-manager` (openai/gpt-5.6)  
**Workers:** `bvs-store-android` · `bvs-store-ios` · `bvs-store-listings`  
**Human notify:** Telegram only when Abias must act (`HUMAN_TASKS.md`)

## Goal

Ship a **sideloadable Android App Bundle/APK** without Play payment, then iOS prep without Mac archive. Pay only when ready to upload.

## Phase 0 — Project spine (done)

- [x] `ops/store-launch/` tree, README, HUMAN_TASKS, STATUS
- [x] Play + App Store listing drafts
- [x] Default model target: `openai/gpt-5.6`
- [x] Capacitor appId `com.bvsradio.app` → loads https://bvsradio.com

## Phase 1 — Android free path (active)

### 1A SDK (VPS)

```bash
export ANDROID_HOME=$HOME/Android/Sdk
export ANDROID_SDK_ROOT=$ANDROID_HOME
export PATH=$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH
# local.properties already: sdk.dir=$HOME/Android/Sdk
```

Packages: platform-tools, platforms;android-35, build-tools;35.0.0

### 1B Capacitor sync

```bash
cd ~/.openclaw/workspace/bvsradio
npm ci || npm install
# hybrid mode uses live URL; still sync native plugins
npx cap sync android
```

### 1C Debug APK (no Play account)

```bash
cd android
./gradlew assembleDebug
# output: app/build/outputs/apk/debug/app-debug.apk
cp app/build/outputs/apk/debug/app-debug.apk \
  ../ops/store-launch/builds/bvsradio-debug.apk
```

### 1D Upload keystore (agent-created, secret) + release AAB

```bash
# one-time keystore under secrets (not git)
# then signingConfigs in app/build.gradle
./gradlew bundleRelease
# output AAB → ops/store-launch/builds/
```

### Phase 1 done when

1. Debug APK installs on a phone (sideload)  
2. Release AAB builds on VPS  
3. Icons/splash acceptable  
4. Listing drafts ready  
5. `STATUS.md` says Phase 1 complete  

**Still no Abias payment.**

## Phase 2 — Play (human gate)

Abias: $25 Console → create app / invite → upload AAB → SHA-256 → we fix assetlinks → internal test → production.

## Phase 3 — iOS prep without Mac (worker)

- [ ] Confirm ios/ Podfile + Info.plist display name, background audio keys draft  
- [ ] Document Xcode Archive steps in `IOS_MAC_RUNBOOK.md`  
- [ ] AASA needs Team ID (human)  

**Archive / TestFlight needs Mac + $99.**

## Risks

| Risk | Mitigation |
|------|------------|
| Thin WebView wrapper rejection | Emphasize native shell + domain-bound content; add minimal native chrome if needed |
| Background audio killed | Capacitor audio / background mode later |
| Mixed content / cleartext | Already HTTPS only |
| IAP rules | Keep checkout on website, not in-app purchase SKUs |

## Worker assignments

| Session | Next actions |
|---------|----------------|
| `bvs-store-android` | SDK verify, cap sync, assembleDebug, then release signing |
| `bvs-store-ios` | Write IOS_MAC_RUNBOOK.md, Info.plist audio notes |
| `bvs-store-listings` | Screenshot size checklist, feature graphic brief |
| `bvs-store-manager` | Review worker logs, update STATUS, Telegram only on human gate |
