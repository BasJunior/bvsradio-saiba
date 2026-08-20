# BVS Radio Beta — isolated update-testing app

## Purpose

`BVS Radio Beta` is a separate Capacitor iOS app that can be installed beside the
public `BVS Radio` app. It is for testing web and native updates before production.

| App | Bundle ID | Native project | Web environment |
| --- | --- | --- | --- |
| BVS Radio | `com.bvsradio.app` | `ios/` | `https://bvsradio.com/app/ios` |
| BVS Radio Beta | `com.bvsradio.beta` | `ios-beta/` | Required `BVS_MOBILE_URL` staging URL |

The beta configuration fails closed when `BVS_MOBILE_URL` is missing. Never point
the beta app at production for write-heavy tests.

## Required staging boundary

Before distributing the beta app, provision:

1. A separate Vercel project or protected staging deployment.
2. A separate Supabase project for staging auth, database and storage.
3. Test-only Stripe/Paynow configuration; never use live payment credentials.
4. A stable HTTPS URL such as `https://beta.bvsradio.com/app/ios`.

Copy configuration names and schema, not production user data or secrets. Apply
the normal idempotent SQL packs to the staging database.

## Build on the Mac

```bash
cd bvsradio-beta
npm ci
mkdir -p out
printf '<!doctype html><title>BVS Beta</title>' > out/index.html
BVS_MOBILE_URL=https://beta.bvsradio.com/app/ios npm run cap:sync:beta:ios
BVS_MOBILE_URL=https://beta.bvsradio.com/app/ios npm run cap:ios:beta
```

In Xcode:

1. Open `ios-beta/App/App.xcworkspace`.
2. Select Team `VGFK77VH73` and automatic signing.
3. Confirm bundle identifier `com.bvsradio.beta` and display name `BVS Radio Beta`.
4. Run on a physical iPhone and confirm it installs beside BVS Radio.
5. Use a separate App Store Connect record and internal TestFlight group only.

## Promotion rule

Develop and test changes on the beta deployment first. Promote the reviewed Git
commit and matching migrations to production; do not patch the production site
manually. While the current public app is under Apple review, do not change its
bundle, App Store Connect submission, or production mobile entry route.
