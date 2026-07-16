# Store launch status

**Updated:** 2026-07-16  
**Model:** `openai/gpt-5.6-sol`  
**Phase:** 1 free-path Android — **complete** (APK + signed AAB)

## Artifacts

| File | Path | Size |
|------|------|------|
| Debug APK (sideload) | `ops/store-launch/builds/bvsradio-debug.apk` | ~3.9 MB |
| Release AAB (Play upload) | `ops/store-launch/builds/bvsradio-release.aab` | ~2.9 MB |

- **package:** `com.bvsradio.app`  
- **version:** 1.0 (versionCode 1)  
- **minSdk 23 / targetSdk 35**  
- **Loads:** https://bvsradio.com  
- **Signing:** upload keystore in `~/.openclaw/secrets/bvsradio-upload.jks` (not in git)

## Done (free path)

- Project spine: README, MANAGER_PLAN, HUMAN_TASKS, listings drafts  
- IOS_MAC_RUNBOOK.md (use when CLI is on Mac)  
- Android SDK + JDK 21 + cap sync  
- Debug APK build verified  
- Signed release AAB  
- OpenClaw manager session key: `bvs-store-manager`  

## Next — Abias when ready (payment)

1. **Play Console $25** → create app `com.bvsradio.app`  
2. Upload `bvsradio-release.aab` (internal testing)  
3. Send agents **Play App Signing SHA-256** → we fill assetlinks + redeploy  
4. Listing copy already drafted under `listings/`  

## Later — Mac

Follow `IOS_MAC_RUNBOOK.md` + Apple $99. VPS cannot Archive.

## No action required right now

You can keep listening via PWA. Sideload APK optional for smoke test.
