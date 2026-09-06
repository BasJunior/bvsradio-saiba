# BVS Radio vNext — App Store Build 6 release gate

Date: 2026-09-06  
App Store app ID: `6792035284`  
Bundle ID: `com.bvsradio.app`  
Intended version/build: `1.1 (6)`

## Current state

- Source branch: `saiba/app-vnext-2026-09`
- Source tip containing the current privacy policy: `3efcac8`
- Build 5 has been archived, validated, uploaded, processed, and selected in App Store Connect.
- Build 5 is **not a public-release candidate**. Its compiled Capacitor `server.url` targets the isolated beta runtime at `https://bvsradio-app-vnext-2026-09.vercel.app/app/ios`.
- The isolated deployment is ready, but the current deployment predates `3efcac8` and uses the beta Supabase project.
- App Store Connect App Privacy now publishes Phone Number and Device ID in addition to the existing disclosures. Device ID is declared for app functionality, linked to the user, and not used for tracking.
- The App Store Connect privacy-policy URL remains `https://bvsradio.com/privacy`. That public page does not yet contain the vNext disclosures from `3efcac8`.
- The dedicated non-admin review credentials are saved in App Store Connect. Their values must never be printed, logged, copied into a handoff, or committed.

## Why submission remains blocked

1. The selected binary points at a beta/staging backend and six demo fixtures.
2. The existing signed Apple 5.2.3 dossier documents version `1.0 (3)` and exactly five cleared recordings. It must not be represented as evidence for the six beta fixtures or the current 25-item production iOS response.
3. The public privacy policy linked from App Store Connect is older than the vNext data handling and the newly published privacy labels.
4. The review account has not been tested end-to-end against a production-backed vNext release target.
5. Fresh vNext App Store screenshots and a final physical-device acceptance pass have not been completed against the release target.

## VPS / backend release handoff

Prepare a stable public **production-backed vNext release endpoint** for the existing App Store app. Do not repoint the approved app or promote a deployment until the release owner explicitly authorizes that production action.

Required inputs and proof:

1. Deploy source `3efcac8` or a reviewed descendant from the apple-rights/vNext lineage. Do not merge beta-only fixtures into the production catalogue.
2. Use production service configuration only on the production release deployment. Prove that the beta Supabase reference is absent from the served client bundles and that no service-role secret is exposed client-side.
3. Publish the vNext privacy text at `https://bvsradio.com/privacy` so it matches the App Store privacy labels, including optional enquiry phone number, user content, purchase/entitlement records, and push device-token handling.
4. Provision or confirm the existing dedicated non-admin Apple review account on the production backend. Test listener/member functionality only; verify that editorial/admin controls are unavailable. Report PASS/FAIL without disclosing credentials.
5. Export the exact rows behind the production iOS fail-closed catalogue. For every item returned by `/api/station/tracks?surface=ios`, provide:
   - track ID, title, and artist;
   - mobile surface and clearance status;
   - rights basis;
   - evidence reference;
   - reviewed/updated timestamp;
   - release/archive source where applicable.
6. Confirm every returned iOS track has a `cleared` mobile-distribution row with a non-empty rights basis and evidence reference. Any incomplete item must fail closed and disappear from the iOS response.
7. Confirm iOS commerce remains gated: no digital purchase or checkout inside the app; pre-existing entitlements may unlock Lyrics Pad; BeatStore licensing remains a Safari/web handoff.
8. Return the stable release URL, deployed source SHA, deployment ID/status, production catalogue count, privacy-policy verification, review-account PASS/FAIL, and the redacted rights export. Do not return secret values.

## M1 / native steps after backend PASS

1. Align this checkout to the exact authorized release SHA without discarding unrelated work or `release-artifacts/`.
2. Keep `MARKETING_VERSION = 1.1`; set `CURRENT_PROJECT_VERSION = 6`.
3. Compile the approved stable production vNext entry URL into Capacitor and run `BVS_APP_VARIANT=vnext BVS_MOBILE_SURFACE=ios BVS_MOBILE_URL=<approved-url> npx cap sync ios`.
4. Open and build from `ios/App/App.xcworkspace`.
5. Run focused tests, typecheck, lint, production build, native-config tests, and archive inspection.
6. Reinstall on the connected iPhone and verify the production release target, sign-in/join staying inside the native app, persistent playback, safe-area/player stacking, Explore mode controls, external Support/Privacy links, Beat licence Safari handoff, background audio, relaunch, and entitlement-gated Lyrics Pad.
7. Capture fresh App Store screenshots from the release target.
8. Produce an updated professional 5.2.3 technical addendum and catalogue appendix for `1.1 (6)`, backed by the exported clearance records and the existing underlying signed rights evidence. Make no unsupported legal claims.
9. Archive, validate, and upload Build 6; wait for processing; select Build 6; update screenshots, review notes, and attachments.
10. Stop before the final **Submit for Review** action and present the complete evidence gate to Abias.

## Completion evidence required before submission

- final source SHA and clean diff summary;
- tests/typecheck/lint/build results;
- archive version/build and signing/entitlement proof;
- embedded icon proof;
- stable production `server.url` proof;
- production catalogue count and per-item rights appendix;
- review-account test result without credential disclosure;
- physical-iPhone results attributed to Abias versus automated/Simulator checks;
- fresh screenshot paths;
- updated rights PDF path and exhibit summary;
- processed/selected Build 6 status;
- exact reviewer notes and response;
- App Store Connect review page complete;
- explicit Abias approval to press Submit for Review.
