# vNext VPS backend handoff → M1 (2026-09-02)

**Status:** VPS backend preparation **complete enough for M1 device work**  
**Branch tip:** `80d52c315f36956a9d7d15f2f121206c03fc76a0` (`saiba/app-vnext-2026-09`)  
**App identity:** existing App Store app `6792035284` / bundle `com.bvsradio.app` (no new app)  
**Backend:** authorized beta Supabase only — `bvsradio-beta` / `kuqdhuomcqonhnwfgrlw`  
**Forbidden:** production Supabase `rdwwyolrxahimcgpkzzy`, `bvsradio.com` production deploys, replacing `bvsradio-beta.vercel.app`

This is a **VPS/web/backend + config handoff**. It is **not** native compile, signing, physical-device acceptance, archive, or TestFlight.

---

## 1. What VPS completed

### 1.1 Source isolation
- Clean worktree: `/home/admin/.openclaw/workspace/bvsradio-app-vnext-2026-09`
- Tracks `origin/saiba/app-vnext-2026-09` at tip `80d52c3`
- Did **not** switch dirty production/other checkouts onto vNext
- Did **not** force-push or reset foreign WIP
- Did **not** apply `d2e0d68` UI commit

### 1.2 Authoritative beta secrets (VPS)
Source: `~/.openclaw/secrets/bvs-supabase-beta.env` (+ `bvs-supabase-beta-db.env`)

Validated:
- URL host = `https://kuqdhuomcqonhnwfgrlw.supabase.co`
- Service-role JWT `ref=kuqdhuomcqonhnwfgrlw`, `role=service_role`
- Anon key present (sb_ format, non-JWT) for beta project
- Production ref **never** used

Local non-committed file for scripts:
- `.env.vnext-beta.local` (gitignored; mode 600)

### 1.3 Beta database schema
Already present on beta (no destructive changes):

| Object | Present | Notes |
|--------|---------|--------|
| `app_push_devices` | yes | RLS on; service-role DML; anon denied |
| `app_notification_preferences` | yes | RLS on; service-role DML; anon denied |
| `community_blocks` | yes | RLS on; service-role DML; anon denied |
| `playlists` / `playlist_tracks` | yes | RLS on |
| `live_chat_messages.room_id` | yes | already existed |

Direct checks (no secrets printed):
- service-role REST select on private tables → **200**
- anon REST select on `app_push_devices` → **401** (expected deny)
- anon `/auth/v1/settings` → **200**
- `psql` presence check → `t|t|t`

### 1.4 Vercel configuration on authorized project `bvsradio-saiba`
Project: `prj_jdey5oej8CGAROfdPK2f5frnq2YK` (also hosts production — writes were scoped)

**Preview + git branch `saiba/app-vnext-2026-09` overrides created:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Tip redeploy with branch metadata:
- `dpl_Gyrn22xmDj8kgAYQH1jMTwVQGQjP`
- `https://bvsradio-saiba-7n2v7m2ed-saiba-bvs.vercel.app`
- Git alias: `https://bvsradio-saiba-git-saiba-app-vnext-2026-09-saiba-bvs.vercel.app`
- Commit: `80d52c3`

### 1.5 Device-reachable web entry (critical)

**Problem:** Preview deployments on `bvsradio-saiba` are behind **Vercel Deployment Protection / SSO** (`302` → `vercel.com/sso-api`). A physical iPhone **cannot** load them without Vercel team login. That breaks Capacitor `BVS_MOBILE_URL`.

**Authorized workaround (not production, not public beta site):**  
Isolated Vercel project created earlier in this lane:

| Item | Value |
|------|--------|
| Project | `bvsradio-app-vnext-2026-09` (`prj_pUxwgY5CsZbNLn9cMGPzSIexBKrf`) |
| Public alias | **`https://bvsradio-app-vnext-2026-09.vercel.app`** |
| Entry path | **`/app/ios`** → HTTP **200** (no SSO) |
| Title | `BVS App vNext \| BVS Radio` |
| Env | beta Supabase trio + `NEXT_PUBLIC_SITE_URL` for this host |
| Redeploy after env | `dpl_ENeKDyPFwYMCuuziPocSbeopJcGb` / `…-4hl8bcwdv-…` |
| Bundle identity check | JS chunks contain **beta ref once**, **prod ref zero** |

This project is **only** for vNext native shell testing. It must **not** be aliased to `bvsradio.com` or replace `bvsradio-beta.vercel.app`.

### 1.6 Boundaries held
- `https://bvsradio-beta.vercel.app` → still **200**, untouched as public beta site
- `https://bvsradio.com` → still **200**, no `--prod` promote of vNext onto it
- No production Supabase writes
- No App Store Connect / TestFlight / archive actions from VPS
- No credential rotation, no bulk user copy

---

## 2. M1: exact build inputs

### Capacitor / env for device build
```sh
# From branch tip 80d52c3 on saiba/app-vnext-2026-09
export BVS_APP_VARIANT=vnext
export BVS_MOBILE_SURFACE=ios
export BVS_MOBILE_URL=https://bvsradio-app-vnext-2026-09.vercel.app/app/ios

# Rejected by capacitor.config.ts (do not use):
# - https://bvsradio.com/...
# - https://bvsradio-beta.vercel.app/...
# - any non-/app/ios path
# - SSO-only *.vercel.app previews that 302 to vercel.com/sso-api
```

`appId` remains **`com.bvsradio.app`** for vNext (existing listing).  
Team expected in tree/AASA: **`VGFK77VH73`** — M1 must still verify live signing/provisioning.

### Suggested M1 sequence
1. Fetch `origin/saiba/app-vnext-2026-09` @ `80d52c3` (or newer tip if advanced; do not reset foreign WIP).
2. Confirm Safari/iPhone can open `BVS_MOBILE_URL` **without** Vercel login.
3. `npm ci` + existing vNext test scripts from `ops/VNEXT_M1_NATIVE_CHECKPOINT_2026-09-02.md`.
4. `npx cap sync ios` with the env above.
5. Sign with **existing** `com.bvsradio.app` profiles (not beta bundle).
6. Install on Abias’s iPhone; verify auth / play / Studio against **beta** backend only.
7. Only after device acceptance: archive / TestFlight as **update** to existing listing (new build number; M1 owns).

### Do not treat as done from VPS
- Offline airplane playback path
- Native Now Playing / 30‑minute background
- APNs end-to-end
- Universal links cold/warm on device
- Archive / TestFlight install
- Final product acceptance

---

## 3. Known issues / follow-ups

| Issue | Severity | Owner |
|-------|----------|--------|
| `bvsradio-saiba` **preview SSO** blocks phone | High for device URL | Abias/Vercel: disable protection for this git branch **or** keep using isolated public project |
| Isolated project `bvsradio-app-vnext-2026-09` is extra surface | Med | Keep until SSO fixed; do not point at prod domains |
| CLI `vercel link` pulled `.env.local` into worktree | Low | gitignored; do not commit |
| Anon key is `sb_` format (not legacy JWT) | Info | Validated against beta; transfer scripts that assume JWT role parse must tolerate `sb_` |
| HTML does not always embed Supabase host; JS chunk check used | Info | Bundle showed beta ref after isolated redeploy |

---

## 4. Rollback notes
- Branch env overrides on `bvsradio-saiba` can be deleted if needed (preview + branch only).
- Isolated project can be paused/unaliased without touching production.
- Beta DB additive tables can remain; do not drop as automatic rollback.
- Public beta + production web unchanged — no rollback required there.

---

## 5. Evidence checklist (VPS)

- [x] Tip `80d52c3` worktree clean of foreign product WIP  
- [x] Beta ref only in secrets used  
- [x] Schema objects present + RLS deny anon on private tables  
- [x] Three Supabase keys on `bvsradio-saiba` preview branch overrides  
- [x] Tip redeployed with branch metadata  
- [x] Public device URL `/app/ios` = 200  
- [x] Bundle identity: beta present, prod absent  
- [x] `bvsradio-beta.vercel.app` + `bvsradio.com` still up  
- [ ] M1 physical device acceptance  
- [ ] TestFlight  

---

## 6. One-line for M1

**Use `BVS_APP_VARIANT=vnext BVS_MOBILE_URL=https://bvsradio-app-vnext-2026-09.vercel.app/app/ios` against beta Supabase `kuqdhuomcqonhnwfgrlw`; keep bundle `com.bvsradio.app`; VPS backend ready, device/signing still yours.**
