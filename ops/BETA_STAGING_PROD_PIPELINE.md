# BVS Beta → Staging → Prod pipeline

**Canonical product chat (ChatGPT):** `bvsradio production` (renamed 2026-08-20; same share thread formerly titled BVS Radio Producer Benefits).

**Owner intent (2026-08-20):** Abias needs to **preview and work with new product** while the App Store build is updating / under review, and **never ship straight to live users** without a test path. Real users mean production is sacred.

**Related:** Apple lock in MEMORY / store-launch notes · GPT share “Producer Benefits” · Discord beta shell `saiba/bvs-radio-beta-shell` · `ops/PRODUCT_VISION_*` · skill `bvs-vps-release`

---

## 1. Three environments (non-negotiable)

| Lane | Purpose | Who uses it | Deploy freedom |
|------|---------|-------------|----------------|
| **Production** | Real users · App Store / Capacitor live site | Public | **Locked** during Apple Review; otherwise only after staging sign-off |
| **Staging (web)** | Full product preview of next release | Abias + agents + internal testers | Free to break; daily deploys OK |
| **Beta app** | Native shell (`BVS Radio Beta` / `com.bvsradio.beta`) pointed at **staging** | Abias phone / TestFlight internal | Independent of App Store prod binary |

```
code branch ──► Vercel Preview / Staging alias
                      │
                      ▼
              Abias previews (web + Beta app)
                      │
                 pass checklist
                      │
                      ▼
              merge → Production (web)
                      │
                      ▼
         (optional) new App Store binary ONLY if native change required
```

**Rule:** Capacitor already loads the **website**. Most “app updates” are **web/staging first**. A new App Store binary is only needed for native/config/permission/bundle changes — not for every BeatStore UI tweak.

---

## 2. What must stay frozen (Apple / live users)

Until Abias explicitly says **Apple Review complete** (or “prod deploy authorized”):

- Do **not** `vercel --prod` from random branches (especially old `main` / M1 checkouts)
- Do **not** change Join / signup / login / Account / player / `/app/ios` **production** UX that App Review saw (unless Abias overrides)
- Do **not** flip iOS catalogue beyond fail-closed reviewed set (“Cleared for iOS”)
- Do **not** treat production as the experiment sandbox

**Allowed anytime:**

- Work on **beta branch** + **staging project**
- Docs, audits, SQL packs on **staging DB only**
- Discord/Telegram agent coding against staging
- Internal TestFlight of **Beta** app (not the review submission)

---

## 3. Logical execution order (product)

Do this **in order**. Do not jump to Flow v2 / labels / brands first.

### Phase A — Plumbing (so preview is real)
1. **Staging Vercel project** (or stable Preview alias): e.g. `beta.bvsradio.com` or `bvs-staging.vercel.app`
2. **Staging Supabase** (separate project) **or** isolated staging schema + keys — never point beta at prod service role for experiments that mutate money
3. **Env matrix** documented: prod vs staging URLs, anon keys, Paynow/Stripe **test** keys on staging
4. **Beta Capacitor** `server.url` → staging only (`ios-beta/` / `com.bvsradio.beta`)
5. Seed staging with safe demo artists/producers/beats (not live user PII dumps unless scrubbed)

### Phase B — Producer money loop (GPT share core)
Freeze **one** entitlement matrix in code + Premium copy (stop 5 vs 25 / 50 vs 150 drift):

| Plan | Price (pilot) | Live beats | Commission |
|------|----------------|------------|------------|
| Free | $0 | **25** (code default) | **15%** |
| Plus | $5/mo · $50/yr | **150** | **8%** |
| Pro | $10/mo · $100/yr | unlimited / fair-use | **3%** |

Ship on **staging** end-to-end:

1. Producer upload → editorial approve → live  
2. Buyer checkout uses **real licence price** (no $29 override)  
3. Ledger: pre-tax → BVS fee → processor → creator net (frozen at purchase)  
4. Creator Studio: earnings, pending/available, line items  
5. Payout request path (even if payout is manual at first)  
6. Free vs Plus limits enforced in UI + API  

### Phase C — Preview habit (Abias daily)
- Open **staging web** + **Beta app**
- Run the **smoke checklist** (below)
- Note bugs in Discord/Telegram once; agents fix on beta branch
- **No prod** until checklist green + Abias “promote”

### Phase D — Promote to production (after Apple / when authorized)
1. Merge beta → canonical `main` (or apple-rights reconciled main — one trunk)  
2. Staging already matches the merge commit  
3. `vercel --prod` **only** from that trunk  
4. Verify live smoke (play, upload small, premium page truth)  
5. Only then schedule App Store **version** if native bits changed  

### Phase E — Later (not blocking preview)
- Flow v2 / Pulse / deeper graph UX  
- Creator Complete bundle  
- Services marketplace fulfilment  
- Labels / B2B  

---

## 4. Smoke checklist (staging must pass before prod)

**Listener**
- [ ] Home loads; Play advances time (not fake 200)
- [ ] Back restores scroll; player survives navigation
- [ ] Search finds a known staging track/beat

**Creator**
- [ ] Sign-in → Creator Studio
- [ ] Producer can create draft beat; editorial can approve on staging
- [ ] Live limit blocks correctly on Free

**Commerce**
- [ ] Beat purchase on **test** Paynow/Stripe
- [ ] Order row + licence snapshot + wallet line with correct commission tier
- [ ] No raw PostgREST errors in UI

**Mobile Beta**
- [ ] Beta app opens staging URL
- [ ] Same play + studio paths work
- [ ] Does **not** hit production API by mistake (check network host)

**Regressions**
- [ ] Premium marketing copy matches entitlements
- [ ] RBAC still from profiles/staff, not client metadata

---

## 5. Git / deploy conventions

| Item | Convention |
|------|------------|
| Feature work | branch off trunk → PR |
| Long-running preview | `saiba/bvs-radio-beta-shell` (or `staging`) |
| Previews | Vercel Preview per PR **or** fixed staging alias |
| Production | **one** Vercel prod project; only trunk; never M1 old-main |
| DB packs | apply to **staging first**; prod only via `apply-supabase-packs` after sign-off |
| Secrets | staging keys in staging env; never copy prod service role into beta casually |

**Agents must:**
1. Ask “staging or prod?” — default **staging**
2. Refuse prod deploy during Apple lock unless Abias overrides in writing
3. Verify on staging URL before claiming done
4. Log non-trivial releases via `saiba_evolve/feedback.py` domain `bvs`

---

## 6. Why this matches “users exist”

| Old habit | New habit |
|-----------|-----------|
| Code → prod → hope | Code → staging → Abias preview → prod |
| App Review blocks all progress | Beta app + staging keep moving |
| Every fix is a “site update” users feel | Users only feel **promoted** releases |
| Feature branch becomes accidental prod | Trunk-only production |

---

## 7. Immediate next actions (agents)

1. Confirm / create **staging** Vercel target + domain alias  
2. Confirm Beta app `server.url` → staging (not `bvsradio.com`)  
3. Freeze producer matrix constants + Premium page on **beta branch**  
4. Implement/fix money loop on staging  
5. Give Abias one bookmark: staging web + TestFlight/internal Beta  
6. Keep prod on Apple lock until explicit unlock  

## 8. Abias one-liners

- **“Preview”** → staging / Beta only  
- **“Ship” / “prod” / “Apple clear — promote”** → production path  
- **“Don’t touch live”** → default during review  

---

*Written 2026-08-20 for Abias step-back + Discord beta work. Prefer this over ad-hoc deploys.*

## Live staging (2026-08-20)
- **https://bvsradio-beta.vercel.app** — see `ops/STAGING_URL.md`
