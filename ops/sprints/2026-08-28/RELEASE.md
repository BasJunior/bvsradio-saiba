# BVS Promotion Gate — Beta → Production

Production is never promoted by blindly merging the whole sprint/beta branch.

## 1. Classify the change
Every candidate must be one of:

- **CONTENT_CONFIG** — tracks, rotation membership, artwork, show/article content, existing-player metadata.
- **WEB_PRODUCT** — web-only Studio, Lyrics Pad, Marketplace, Money or onboarding behavior.
- **IOS_VISIBLE_PRODUCT** — remotely served functionality that materially changes what the approved iOS app can do.
- **NATIVE_BINARY** — Capacitor/native shell, permissions, plugins, MinOS, signing or native lifecycle behavior.
- **LEGAL_ACCOUNT** — organization/trader/contact/account-state changes.

A feature may require more than one classification; use the highest-risk class for promotion.

## 2. Required promotion record
Before promotion record:

- feature/task name;
- source branch + exact SHA;
- files changed;
- database migration(s), if any;
- deployment tested;
- surface classification;
- payment impact;
- rights/content impact;
- App Store impact assessment;
- smoke tests and result;
- rollback SHA/deployment/migration position;
- explicit approval to promote.

## 3. Beta acceptance checks

### Always
- Vercel build READY.
- TypeScript passes.
- no new 5xx/runtime error cluster attributable to the feature.
- authentication fails closed where required.
- mobile viewport checked for creator-facing UI.
- no secrets/PII added to client analytics or logs.

### Payments / licences / money
- server price remains authoritative;
- unpaid orders grant no entitlement;
- buyer identity is bound server-side;
- duplicate payment/webhook handling remains idempotent;
- licence/order records survive reload;
- direct client writes cannot forge financial/rights state.

### Song Workspace / Rights Passport
- only paid/fulfilled beat buyer can create/open the workspace;
- different account cannot open guessed workspace ID;
- beat ID must belong to the paid order;
- direct browser INSERT/UPDATE/DELETE of entitlement state is unavailable;
- Lyrics Pad uses safe preview playback, not private producer master/stems;
- BVS-issued licence carries into leased-beat clearance;
- external leased beats still require evidence.

### Content / iOS
- web rotation endpoint count verified;
- `surface=ios` endpoint verified separately;
- every new iOS track has an explicit `mobile_distribution_clearances` evidence record;
- no bulk clearances;
- rollback is deletion/revocation of the specific clearance row(s), not a binary release.

## 4. Promotion routes

### CONTENT_CONFIG
Editorial/data change → verify web → if iOS requested, separate evidence review → add individual clearance rows → verify `surface=ios` → smoke on shipped app.

### WEB_PRODUCT
Sprint branch → beta build → signed-in E2E QA → feature-level production commit/cherry-pick → production web smoke.

### IOS_VISIBLE_PRODUCT
Beta web QA → determine whether this changes approved app functionality. If materially new, include deliberately in an App Store release rather than silently relying on remote web promotion.

### NATIVE_BINARY
Native branch/build → device QA → App Store Connect release/review process. Do not couple ordinary content growth to this lane.

## 5. Current recovery points
At sprint start:
- active beta recovery SHA: `124690a7f4dc1c7c36a53b2635eda10e495e3bdc`
- active beta recovery deployment: `dpl_2KNDdBJKnP3sTZ6MFvkDBHTT7q3r`
- main/production code SHA: `9b2c7a9dcbda5915ecaf7cf492bf3d0a7b684ca8`

Database changes must also record the migration immediately before/after the feature. Never attempt an automatic destructive rollback of user data; use a reviewed forward fix when necessary.

## 6. Approval rule
- Saiba may prepare, test and recommend a promotion.
- Production/main, production DB mutations, mass iOS clearance and App Store binary actions require explicit BVS approval.
