# TestFlight internal setup (app 6792035284)

Build **1.0 (1)** is uploaded and **Ready to Submit**.

## Manual (2 minutes) — App Store Connect session required

1. Open: https://appstoreconnect.apple.com/apps/6792035284/testflight/ios
2. **Create Group** → name `Internal` → create
3. Open group → **Testers** → **+** → add your Apple ID (iPhone App Store email)
4. **Builds** → **+** → select **1.0 (1)**
5. If compliance banner: encryption = only standard HTTPS / no non-exempt
6. On iPhone: install **TestFlight** → open invite → **Install**

## Optional automation later (API key)

Create key: https://appstoreconnect.apple.com/access/integrations/api  
Role: App Manager or Admin. Download `.p8`, note Key ID + Issuer ID.

```bash
export APP_STORE_CONNECT_API_KEY_ID=XXXXXXXXXX
export APP_STORE_CONNECT_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
export APP_STORE_CONNECT_API_KEY_PATH=~/AuthKey_XXXXXXXXXX.p8
cd bvsradio-saiba
# then: fastlane pilot add -a com.bvsradio.app -e you@email.com
```
