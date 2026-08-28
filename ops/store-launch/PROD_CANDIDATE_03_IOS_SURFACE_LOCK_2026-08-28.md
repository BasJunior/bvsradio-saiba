# Candidate 03 — iOS Surface Lock (2026-08-28)

**Status:** PREVIEW FROZEN — awaiting explicit BVS production approval  
**Branch:** `saiba/prod-candidate-ios-surface-lock-2026-08-28`  
**Worktree:** `/home/admin/.openclaw/workspace/bvsradio-prod-candidate-ios-surface-lock-2026-08-28`  
**Hard stop:** no `main` update, no production alias, no native/Capacitor change, no DB/clearance writes, no Studio/Lyrics bundling.

---

## 1. Freeze record

| Field | Value |
|-------|--------|
| Production base SHA | `eb80df4f276c40461b8d849195f7d2dfa9f9dda3` |
| Production base message | `fix(web): keep Studio quick nav in sync with loaded sections` |
| Live production deployment | `dpl_ANWXUhGAiPmxYNM5hFYKmVTW1WKd` (`bvsradio-saiba-ed1rag6pm-saiba-bvs.vercel.app`) |
| Live aliases | `bvsradio.com`, `www.bvsradio.com` |
| Production created | 2026-08-24 20:13 Europe/Berlin |
| Lineage | apple-rights / iOS harden (`a8cd140`) ⊂ prod-safe chain → `eb80df4` |
| GitHub `origin/main` | `9b2c7a9` — **not** live production UI (do not branch candidates from bare main for iOS shell) |
| Candidate gated runtime SHA | `c0ede38eace1312471b86ce6faea6e5976e859a1` |
| Evidence freeze | docs-only commit on this branch after `c0ede38`; runtime remains the gated preview |
| Runtime code tip | `b83f498` (iOS listen lock) + `c0ede38` (automatic build gate) |
| Prior preview (pre-gate) | `dpl_FEfqAAEzmApy629bvRQiRc6f4Td5` |
| Gated preview deployment | `dpl_7hwSwfbJn6nBteZmAouzxLeFQSkD` |
| Preview URL | https://bvsradio-saiba-iip9g3gy4-saiba-bvs.vercel.app *(SSO-protected)* |
| Preview git alias | https://bvsradio-saiba-git-saiba-prod-candidate-ios-su-885367-saiba-bvs.vercel.app |
| Inspect | https://vercel.com/saiba-bvs/bvsradio-saiba/7hwSwfbJn6nBteZmAouzxLeFQSkD |
| Gated preview created | 2026-08-28 10:16 Europe/Berlin |
| Sibling preview | `dpl_9kotmR7jTjnXrGGYqaXo4DxDdftN` **BLOCKED** (non-blocking; Ready gated deploy is the freeze target) |
| DB migrations | **none** |
| Clearance row changes | **none** |
| Native / Capacitor changes | **none** |

### Capacitor (unchanged)
- `capacitor.config.ts` → `server.url = https://bvsradio.com/app/${mobileSurface}`
- iOS → `https://bvsradio.com/app/ios`
- `appId`: `com.bvsradio.app`
- No `allowNavigation` host list (Build 3 posture)

### What the installed App Store shell exposes today
- Native WebView root: `/app/ios`
- Listener chrome: Home / Explore / Beats / Library (+ contained track/beat/artist/account)
- `MobileIosBoundary` fail-closed outside `/app/ios/*` (externalise other site destinations)
- Station: `GET /api/station/tracks?surface=ios` → only `mobile_distribution_clearances` **cleared** for `ios`
- Observed live iOS count at freeze time: **16** (server content; not changed by this candidate)
- Observed live web station count: **65**
- No Creator Studio / Lyrics Pad / Song Workspace inside the iOS shell

---

## 2. Exact changed files (candidate)

| Path | Role |
|------|------|
| `src/lib/ios-surface-lock.ts` | Allow/deny contract + plain-copy guard |
| `src/lib/ios-surface-copy.ts` | Server copy lane (headings/empty states/account help) |
| `src/components/app/IosHomeListenPanel.tsx` | iOS-stable listen panel (fork of web panel) |
| `src/components/app/IosListenHero.tsx` | Locked iOS hero using copy lane + stable panel |
| `src/app/app/[surface]/page.tsx` | iOS branch → locked hero/copy; android keeps prior path |
| `src/app/app/[surface]/beats/page.tsx` | iOS empty-state copy from lane |
| `src/components/MobileAccountPanel.tsx` | Account help copy from lane |
| `scripts/ios-surface-lock-tests.mjs` | Regression guards |
| `package.json` | `test:ios-surface-lock`, `test:ios-surface-gates`, and **build/`vercel-build` run gates before `next build`** |
| `ops/store-launch/PROD_CANDIDATE_03_IOS_SURFACE_LOCK_2026-08-28.md` | This evidence package |

**Not changed:** `capacitor.config.ts`, `ios/**`, plugins, entitlements, SQL packs, clearance tables, Studio/Lyrics candidate code.

---

## 3. Design

### Allowlisted iOS experience
- Home listening surface + player
- Explore / Beats / Library / Account already on `/app/ios/*`
- Contained track / beat / artist detail
- BVS iOS-cleared catalogue only
- Safe listener auth already present

### Explicitly out (unless separate App Store decision)
- Creator Studio
- Lyrics Pad / Song Workspace
- Creator Marketplace management
- New in-app checkout/purchase flows
- Admin/editorial tooling
- Experimental beta UI

### Copy/content lane
Structural behaviour stays locked. Plain strings in `IOS_SURFACE_COPY` may change headings, empty states, account help.  
`assertPlainIosCopy` rejects URLs, markup, and route paths so copy cannot inject new navigation/product UI.

### Shared dependency split
| Shared OK | Split for lock |
|-----------|----------------|
| `StationPlayer` / auth / station API contracts | `IosHomeListenPanel` vs web `HomeListenPanel` |
| `AppRail` / cards / object builders | iOS home hero + copy lane |
| Clearance-backed `getStationTracks('ios')` | — |

Isolation proof (local): mutating web `HomeListenPanel` text does **not** change `IosHomeListenPanel`.

---

## 4. Safe-update matrix (future changes)

| Class | Examples | Ship path |
|-------|----------|-----------|
| **iOS-safe remote content** | copy lane strings, artwork, metadata, BVS iOS-cleared catalogue/config | Server/content only; no binary |
| **Web-only** | Studio, Lyrics Pad, creator/product UX on website routes not mounted in iOS shell | Web prod promote; keep off `/app/ios` imports/links |
| **iOS-visible product change** | new in-app surface, new primary nav, commerce inside shell | Explicit BVS review + usually App Store release |
| **Native** | Capacitor, plugins, permissions, bundle id, MinOS | New binary / App Store process |

### Automatic build gate (required)
Vercel / local production builds now run:
```bash
npm run test:ios-surface-gates   # = test:ios-surface-lock && test:apple-ios-surface
next build
```
via both `build` and `vercel-build`. A green deploy cannot skip the iOS lock.

### Manual regression commands
```bash
npm run test:ios-surface-gates
npm run test:app-flow
npm run typecheck
```

---

## 5. Verification

| Check | Result |
|-------|--------|
| `test:ios-surface-lock` | **PASS** |
| `test:apple-ios-surface` | **PASS** |
| `test:ios-surface-gates` | **PASS** (composite gate) |
| `test:app-flow` | **PASS** |
| `typecheck` | **PASS** (tsc --noEmit) |
| `build` / `vercel-build` scripts | run gates **before** `next build` |
| Gated preview build (`c0ede38`) | **Ready** `dpl_7hwSwfbJn6nBteZmAouzxLeFQSkD` — cloned `saiba/prod-candidate-ios-surface-lock-2026-08-28` @ `c0ede38`; ran `npm run vercel-build` → `test:ios-surface-gates && next build`; lock assertions passed; Apple iOS-surface assertions passed; Next compiled |
| Preview `/app/ios` HTTP | **302** Vercel SSO (protected preview, expected) |
| Isolation proof (local) | Mutating web `HomeListenPanel` did **not** change `IosHomeListenPanel`; files differ; iOS home imports locked hero only |
| Production alias untouched | **confirmed** `dpl_ANWXUhGAiPmxYNM5hFYKmVTW1WKd` on `bvsradio.com` / `www.bvsradio.com` (created 2026-08-24 20:13 Berlin) |
| Live production `/app/ios` | **HTTP 200** (unchanged live shell) |
| Live iOS station (unchanged by candidate) | count **16**, surface `ios`, source `mobile-ios` |
| Live web station | count **65** |
| Capacitor / native files in diff | **none** |
| Studio / Lyrics bundled | **no** |

## 5b. Release sequence after this gate freezes
1. Explicit BVS production approval for Candidate 03 only.
2. Promote Candidate 03 → verify installed App Store shell still listen-only.
3. **Do not** promote old Candidate 01 as-is (it was cut from GitHub `main`, not live prod lineage).
4. Recut Studio from the **new** production tip; transplant only intended Studio changes → preview → web production.
5. No App Store resubmission in that sequence.

---

## 6. Rollback

1. Do **not** promote candidate if issues found.  
2. If ever promoted: redeploy previous production deployment `dpl_ANWXUhGAiPmxYNM5hFYKmVTW1WKd` / SHA `eb80df4`.  
3. Branch remains disposable; delete worktree/branch after reject or after successful promote+settle.

---

## 7. Explicit production approval gate

**Do not** alias this candidate to `bvsradio.com` until Abias/BVS explicitly approves Candidate 03.  
After approval + settle, return to **Candidate 01 Studio → web production** under the same surface rules (Studio must remain web-only / non-iOS-mounted unless a later iOS release says otherwise).

## 8. Known shared dependencies still shared by design
- `StationPlayer`, library sync, Supabase auth session
- `BvsObjectCard` / flow cards
- Station + beat data loaders (iOS still clearance-gated on station)

These are intentionally compatible contracts. Material player/auth behaviour changes still need iOS impact review before prod web promote.
