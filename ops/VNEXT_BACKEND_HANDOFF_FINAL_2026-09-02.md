# BACKEND HANDOFF — BVS app vNext (existing listing) — 2026-09-02

```
BACKEND HANDOFF: PASS (with documented blockers)
FINAL BRANCH: saiba/app-vnext-2026-09
FINAL FULL SHA: f1f856951eea324fe37102063a4a2320e17fb325
  (app code tip still includes 80d52c3; f1f8569 = VPS handoff docs + gitignore only)
VNEXT IMMUTABLE DEPLOYMENT URL:
  isolated device entry: https://bvsradio-app-vnext-2026-09-7tsoraskn-saiba-bvs.vercel.app
  (dpl inspect path ends …/9fw4biEvus2atnECSuuQNi76qZJC)
  saiba branch rebuild (SSO): https://bvsradio-saiba-2wq7nt2pr-saiba-bvs.vercel.app
VNEXT STABLE ORIGIN: https://bvsradio-app-vnext-2026-09.vercel.app
IOS ENTRY URL: https://bvsradio-app-vnext-2026-09.vercel.app/app/ios
SUPABASE TARGET: bvsradio-beta / kuqdhuomcqonhnwfgrlw
```

M1 does **not** need service-role, R2, or SMTP secrets. Runtime is configured remotely.

---

## CONFIGURED VARIABLE NAMES + EXACT SCOPE (no values)

### A) `bvsradio-saiba` (`prj_jdey5oej8CGAROfdPK2f5frnq2YK`)
**Scope only:** `target=preview` + `gitBranch=saiba/app-vnext-2026-09`

| Key | Notes |
|-----|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | beta |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | beta (`sb_` modern key; header-auth verified) |
| `SUPABASE_SERVICE_ROLE_KEY` | beta JWT `role=service_role` `ref=kuqdhuomcqonhnwfgrlw` — **server-only**, never `NEXT_PUBLIC_` |
| `BVS_ENV_LANE` | `staging` |
| `NEXT_PUBLIC_SITE_URL` | device-reachable isolated origin (not bvsradio.com) |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` `SMTP_FROM` | beta/shared IONOS mail for confirmation tests |
| `R2_ENDPOINT` `R2_ACCESS_KEY_ID` `R2_SECRET_ACCESS_KEY` `R2_BUCKET` `R2_KEY_PREFIX` | see media isolation |

**Not written:** Production target, Development, other branches, global overwrites of unrelated vars.

### B) Isolated device project `bvsradio-app-vnext-2026-09` (`prj_pUxwgY5CsZbNLn9cMGPzSIexBKrf`)
Same key set on project `production+preview` targets for **this project only** (not aliased to bvsradio.com / not public beta site). Required because `bvsradio-saiba` previews are SSO-gated.

---

## DEPLOYED BACKEND IDENTITY CHECK

| Check | Result |
|-------|--------|
| Secret file URL host | `…kuqdhuomcqonhnwfgrlw.supabase.co` |
| Not production ref | `rdwwyolrxahimcgpkzzy` absent |
| Service JWT role/ref | `service_role` / `kuqdhuomcqonhnwfgrlw` |
| Anon key format | modern `sb_` (not legacy JWT) — **Authorization Bearer + apikey headers work** |
| Harmless API | anon `/auth/v1/settings` → 200; svc private tables → 200; anon private tables → 401 |
| Runtime `/api/build` on device origin | `{"sha":"dpl_9fw4biEvus2a","env":"staging"}` |
| JS bundle on `/app/ios` | beta ref **present**, prod ref **absent** |
| Five-tab shell tokens in HTML | Home, Explore, Beats, Library, Rooms, Studio present; title `BVS App vNext` |

`/api/build` does **not** name Supabase; backend identity proven separately (above).

---

## NATIVE URL ACCESS / DEPLOYMENT PROTECTION

| URL | Device loadable? |
|-----|------------------|
| `https://bvsradio-app-vnext-2026-09.vercel.app/app/ios` | **YES** — HTTP 200, no SSO |
| `bvsradio-saiba-*-saiba-bvs.vercel.app` previews | **NO** — 302 → Vercel SSO |
| `bvsradio-saiba-git-saiba-app-vnext-2026-09-saiba-bvs.vercel.app` | **NO** — SSO |

**Policy:** Did **not** disable Deployment Protection or embed bypass tokens. Device path uses the isolated public origin.

**M1 env:**
```bash
BVS_APP_VARIANT=vnext \
BVS_MOBILE_SURFACE=ios \
BVS_MOBILE_URL=https://bvsradio-app-vnext-2026-09.vercel.app/app/ios \
npx cap sync ios
```
Open `ios/App/App.xcworkspace`. Bundle remains **`com.bvsradio.app`** (not `com.bvsradio.beta`).

---

## BETA MIGRATIONS APPLIED OR ALREADY PRESENT

Already present on beta (no destructive apply this session):

- `app_push_devices` (RLS on)
- `app_notification_preferences` (RLS on)
- `community_blocks` (RLS on)
- `playlists` / `playlist_tracks` (RLS on)
- `live_chat_messages.room_id` (present)

SQL references in branch: `supabase-app-vnext-2026-09.sql`, `supabase-app-vnext.sql` (audit scaffolding; live state already matched).

---

## BETA MEDIA ISOLATION

| Item | Status |
|------|--------|
| Bucket name configured | `bvsradio-media` (from authorized `bvs-r2.env`) |
| `R2_KEY_PREFIX` | `vnext-beta/` (not present in secret file; set as logical namespace) |
| Isolation honesty | **shared-bucket + prefix**, same R2 account/credentials as general media — **not** separate credential-level isolation |
| Default code bucket without env | would be `bvsradio-media` — env now forces prefix for vNext lane |
| Supabase storage buckets list (beta) | empty list via Storage API (catalogue often uses public `bvsradio-audio` marker paths / DB URLs) |
| Offline masters | `/api/app/offline/manifest` requires `mobile_distribution_clearances` status=`cleared`, public+rotation+approved track, and existing private R2 object |

Do **not** treat prefix alone as multi-tenant hard isolation.

---

## AUTH / CALLBACK / MAIL

| Item | Status |
|------|--------|
| `NEXT_PUBLIC_SITE_URL` on vNext | isolated origin `https://bvsradio-app-vnext-2026-09.vercel.app` |
| SMTP vars on vNext scope | set from authorized IONOS secret file (names only reported) |
| Auth helpers | `src/lib/auth-url.ts`, `auth-email.ts`, `mailer.ts` — prefer site URL; block localhost redirects in non-dev |
| Supabase redirect allowlist | **not modified** this session (no security-setting write). M1/VPS may need exact callback  
  `https://bvsradio-app-vnext-2026-09.vercel.app/auth/confirmed`  
  (and recovery paths) added under beta project with Abias authorization if missing |
| Email copy still saying bvsradio.com | not mass-rewritten; staging site URL should dominate link generation when env is set |
| Test recipients | use existing beta QA fixture only; **no passwords in chat** |

---

## PLAYLIST OWNERSHIP / ROOMS / STUDIO / OFFLINE / PUSH

| Area | Evidence level | Result |
|------|----------------|--------|
| Playlist tables + RLS | service can select; anon denied on private-ish REST | **schema/RLS PASS**; full User A/B mutation matrix **not** executed end-to-end in this pass (needs signed-in test users on device/web session) |
| Rooms/community | routes require sign-in; block list GET/POST/DELETE; messages filter blocked peers; rate limit present in source | **source + table PASS**; live post/report matrix deferred to signed-in session |
| Studio roles | existing identity model (profiles/staff); signup-role unit tests PASS | **unit PASS**; no metadata privilege grant invented |
| Offline manifest | fail-closed without clearance / missing master / wrong surface; ~10m download URL intent + ~7d licence in source | **source PASS**; no auto-clear; disposable cleared fixture not minted this pass |
| Push registration tables | RLS deny anon; svc OK | **registration storage PASS** |
| APNs **sender** | source mentions native registration helpers only; **no server APNs p8 sender pipeline found as complete delivery service** | **registration ≠ delivery**; M1 device token + server sender ownership still open |

Payments: safe-floor + marketplace economics tests PASS; **no live Stripe/Paynow/EcoCash creds copied**; no real charges.

---

## WEB / IOS CI / ANDROID CI / VERCEL

| Gate | Result |
|------|--------|
| `npm run test:app-links` | PASS |
| `npm run test:native-config` | PASS |
| `npm run test:native-contract` | PASS |
| `npm run test:safe-floor` | PASS |
| `npm run test:marketplace-economics` | PASS |
| `npm run test:signup-roles` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS (local, staging public env) |
| GitHub Actions iOS/Android CI | **not claimed green from this host** — M1/CI must confirm on `f1f8569` |
| Vercel isolated alias | Ready; `/app/ios` 200; `/api/build` staging |
| Vercel saiba branch preview | rebuilt with env; **SSO protected** |
| `bvsradio.com` | untouched (still 200) |
| `bvsradio-beta.vercel.app` | untouched (still 200) |

---

## TEST ACCOUNT ACCESS

- Authorized beta QA secret file exists on VPS (`bvs-beta-qa-kudzi.env`) — **credentials not transmitted**.
- Production App Review account **not** used.
- If M1 needs local test login: private path handoff only, never chat.

---

## PRODUCTION CHANGES: NONE
## CURRENT PUBLIC BETA DEPLOYMENT/ALIAS CHANGES: NONE

## BETA DATABASE CHANGES
- **None applied this session** (objects already present). No drops, no bulk user ops, no password resets, no mass mail.

---

## REMAINING BLOCKERS / FOLLOW-UPS

1. **SSO** on `bvsradio-saiba` previews — policy decision if Abias wants branch alias phone-loadable without isolated project.
2. **Supabase Auth redirect allowlist** — confirm/add isolated origin callbacks (no blind wildcards).
3. **R2 isolation** is prefix-level on shared bucket/credentials — acceptable for disposable vNext objects only; do not mix prod masters under `vnext-beta/`.
4. **Signed-in acceptance matrix** (playlist A/B, rooms report/block live, Studio role on real sessions, offline cleared fixture) — best on device after M1 sync.
5. **APNs server sender** not complete; device push delivery remains M1 + backend sender task.
6. **M1-only:** signing, build number bump from `1.0 (1)`, archive, TestFlight, native Now Playing / 30‑min background, offline download→player path, universal links cold/warm.
7. Optional: feature flags remain default-off (`NEXT_PUBLIC_BVS_SHOW_ROOMS` etc. not bulk-enabled).

---

## Success definition (VPS)

Verified **beta-backed vNext web runtime** ready for M1 Capacitor sync against:

`https://bvsradio-app-vnext-2026-09.vercel.app/app/ios`

This is **not** “iPhone update finished.”
