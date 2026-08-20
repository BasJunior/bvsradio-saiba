# BVS Supabase SQL application workflow — **agent-first**

**Goal:** BVS agents (OpenClaw / Grok / Codex) apply and verify schema packs **without Abias pasting SQL** for routine site work.  
**You (Abias)** only do a **one-time credential drop** (and rare break-glass).  
**Rule:** Never put DB passwords or service keys in git, Telegram, or chat logs.

---

## 1. Who does what

| Actor | Responsibility |
|-------|----------------|
| **BVS agents** | Detect missing packs → apply SQL in order → verify → Telegram result |
| **Abias** | One-time: store `DATABASE_URL` in secrets (below). Optional: storage buckets UI, Auth URL check |
| **Break-glass** | Abias uses SQL Editor only if agent path fails (IP allowlist, password rotate) |

Service-role JWT **cannot** run DDL. Agents need a **Postgres URI**.

---

## 2. One-time setup (Abias, ~5 minutes)

Do this once so agents never ask you to run SQL for normal deploys.

1. Supabase Dashboard → **Project Settings → Database**  
2. Copy **Connection string → URI** (postgres user + database password)  
   - Prefer **Session** or **Direct** if Transaction pooler rejects DDL  
3. On the VPS:

```bash
install -m 600 /dev/null /home/admin/.openclaw/secrets/bvs-supabase-db.env
# paste:
# DATABASE_URL=postgresql://postgres....:PASSWORD@...:5432/postgres
chmod 600 /home/admin/.openclaw/secrets/bvs-supabase-db.env
```

Template: `/home/admin/.openclaw/secrets/bvs-supabase-db.env.example`

4. Confirm Vercel still has `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (already used by the app / REST verify).  
5. Tell any agent: **“SQL agent path enabled”** or just run a BVS task — skill will try apply automatically.

**Network:** If Supabase restricts DB IPs, allow this VPS public IP (or temporary `0.0.0.0/0` for setup).

---

## 3. Agent standard operating procedure

When a BVS task needs schema (upload, editorial, wallet, releases, chat, play counts, analytics):

```bash
cd /home/admin/.openclaw/workspace/bvsradio

# 1) Status (no mutations)
python3 scripts/apply-supabase-packs.py --status

# 2) Apply anything pending (non-interactive)
python3 scripts/apply-supabase-packs.py --apply-missing --yes

# 3) Or one pack after editing its .sql file
python3 scripts/apply-supabase-packs.py --pack releases --yes

# 4) REST double-check (service role from env / vercel pull)
python3 scripts/verify-supabase-schema.py --full
```

### Expected agent behavior

1. Load skill **`bvs-vps-release`** (references this workflow).  
2. Run `--status`.  
3. If `BLOCKED: no DATABASE_URL` → Telegram Abias **once** with setup steps; do **not** invent schema.  
4. If packs `PENDING` / `STALE_FILE_CHANGED` → `--apply-missing --yes`.  
5. On `ERROR` → stop, log, Telegram with pack id + error type (no secrets).  
6. On success → continue feature work; user-visible verify still required.  
7. Log run under `ops/sql-runs/YYYY-MM-DD/` when non-trivial.

Agents **do not** re-ask Abias to paste SQL when `DATABASE_URL` works.

---

## 4. Pack order (canonical)

| Step | Pack id | File | Notes |
|------|---------|------|--------|
| 0 | `schema` | `supabase-schema.sql` | Skipped if `tracks` already exists |
| 1 | `library-sync` | `supabase-library-sync.sql` | |
| 2 | `analytics` | `supabase-analytics.sql` | |
| 3 | `editorial` | `supabase-editorial-workflow.sql` | |
| 4 | `wallet` | `supabase-artist-wallet-ledger.sql` | Before final-sprint |
| 5 | `releases` | `supabase-releases-pipeline.sql` | |
| 6 | `creator` | `supabase-creator-workflows.sql` | + private bucket `show-episodes` |
| 7 | `community` | `supabase-community-chat.sql` | |
| 8 | `final-sprint` | `supabase-final-sprint-core.sql` | play events, tax cols, ledger index |
| 10 | `beatstore-mvp` | `supabase-beatstore-mvp.sql` | producer beats, licences and ownership |
| 11 | `producer-collaboration` | `supabase-producer-collaboration.sql` | producer/editor review conversations |
| 12 | `profile-role-applications` | `supabase-profile-role-applications.sql` | account role requests + editorial decisions |
| 13 | `creator-identities` | `supabase-creator-identities.sql` | private/member/public creator-name separation + editorial review |
| 14 | `track-reclassification` | `supabase-track-reclassification.sql` | single-track review messages + atomic Track → BeatStore reclassification |
| 15 | `commerce-ledger` | `supabase-commerce-ledger.sql` | canonical products, immutable prices/licences/order items + verified payment events |
| 16 | `rights-passport` | `supabase-rights-passport.sql` | contributor permissions, ownership scope and deterministic release preflight |
| 17 | `media-preflight` | `supabase-media-preflight.sql` | private audio analysis queue, derivatives, duplicate detection and publication gate |
| 18 | `qr-login` | `supabase-qr-login.sql` | five-minute, single-use phone → computer login pairings |
| 19 | `release-clearance-evidence` | `supabase-release-clearance-evidence.sql` | versioned proof and publication gates for covers, remixes, samples, leased beats and third-party material |
| 20 | `beat-packs` | `supabase-beat-packs.sql` | ordered producer BeatStore pack submissions |
| 23 | `founder-authority` | `supabase-founder-authority.sql` | single protected BVS Founder authority + BasJunior assignment |
| 24 | `security-hardening` | `supabase-security-hardening.sql` | server-only operational tables and mutation RPCs |
| 25 | `marketplace-economics` | `supabase-marketplace-economics.sql` | immutable seller fee snapshots, settlements, processor fees and refund reversals |
| 26 | `creator-marketplace` | `supabase-creator-marketplace.sql` | multi-role creator profiles, accomplishments and moderated product/service listings |
| 27 | `marketplace-services` | `supabase-marketplace-services.sql` | professional profile fields and held creator-service fulfilment lifecycle |
| 28 | `mobile-distribution` | `supabase-mobile-distribution.sql` | evidence-gated iOS catalogue now; same surface model reserved for Android later |
| 29 | `artwork-change-requests` | `supabase-artwork-change-requests.sql` | artist/producer cover replacements for tracks, releases, beats and beat packs; editorial apply-on-approve |
| 30 | `flow-v2-measurement` | `supabase-flow-v2-measurement.sql` | server-only 30-second stream qualification records; settlement remains separate |

Bookkeeping table (created by applier): `public.bvs_schema_packs`  
Stores pack id, file sha256, applied_at — so agents know what changed.

---

## 5. When agents auto-apply

| Trigger | Action |
|---------|--------|
| New/changed `supabase-*.sql` in a BVS PR/task | `--apply-missing --yes` before deploy verify |
| Feature needs table that verify marks MISSING | Apply that pack (+ deps) |
| Daily/ops health | `--status` only unless pending |
| Production incident “relation does not exist” | Apply missing packs, then re-verify feature |

**Never auto-apply:** destructive ad-hoc SQL not in repo packs; production data deletes.

---

## 6. Scripts

| Script | Role |
|--------|------|
| `scripts/apply-supabase-packs.py` | **Agent apply** via Postgres URI |
| `scripts/verify-supabase-schema.py` | REST presence checks (service role) |
| `scripts/verify-releases-tables.py` | Sample release rows |
| `scripts/bootstrap-editorial-admin.py` | Owner staff bootstrap (service role) |

---

## 7. Storage & Auth (still semi-manual)

SQL does not always create storage buckets.

| Item | Owner |
|------|--------|
| Bucket `show-episodes` (private) | Agent notes if missing; Abias or dashboard API if no storage API key |
| Audio bucket policies | Same |
| Auth Site URL / redirects | `ops/SUPABASE_AUTH_REDIRECTS.md` — verify via API if possible; dashboard if not |

Agents should still **check** and only escalate when UI-only.

---

## 8. Failure playbook (agents)

| Symptom | Action |
|---------|--------|
| `BLOCKED: no DATABASE_URL` | Telegram Abias setup once; block schema-dependent claims |
| `CONNECT FAIL` / timeout | Check IP allowlist, password, pooler mode; try direct host |
| Pack `ERROR` mid-order | Stop; do not skip ahead; fix SQL in repo; re-run same pack |
| REST verify MISSING after apply | Schema cache delay — wait 30s, re-verify; check correct project URL |
| `STALE_FILE_CHANGED` | Re-apply that pack so sha matches |

---

## 9. CapCut (content — unrelated to SQL)

CapCut stays a **parallel marketing track** (launch intro / how-to-submit videos). Agents do not need Abias for SQL just because CapCut exists; video is optional growth work.

---

## 10. Success criteria

- Abias is **not** in the loop for “please run this SQL” on normal BVS ships.  
- Agents prove packs with `--status` / verify, not assumptions.  
- Secrets stay in `~/.openclaw/secrets/bvs-supabase-db.env` mode 600.

---

*Rewritten agent-first 2026-07-23.*
