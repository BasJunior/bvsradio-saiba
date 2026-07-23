# BVS Radio — Sprint plan: impress, retain, discover bugs

**Date:** 2026-07-23 (rev B: Codex review + tightened Sprint 1)  
**Audience:** Abias · Saiba · any BVS agent  
**Live site:** https://bvsradio.com (Vercel, HTTP 200 across core routes)  
**Goal:** Move from “impressive scaffold” to a product listeners and artists **trust, return to, and tell others about** — with a bug-discovery system that does not depend on customers filing tickets.

---

## 0. Codex review (2026-07-23) — rating **8/10**

Independent review (Codex / Saiba) of this plan:

**Strengths:** honest baseline; full listener→creator→buyer→ops loop; user-visible verification; silent-failure focus; submit→rotation before premium distro; practical first-48h.

**Why not 9–10:** oversized for 3 weeks; dirty tree needs ownership gate; tasks lacked owners/estimates/deps; metrics need baselines first; SQL/payments/Sentry need failure paths; stores/marketing should not share the core eng sprint.

**Execution rule (locked):** greenlight direction, **tighten Sprint 1** to the seven items below. Everything else is Sprint 2+ backlog.

### Sprint 1 only (must complete — no stores, no CapCut, no Industry Watch)

| # | Outcome | Owner default | Depends on | Done when |
|---|---------|---------------|------------|-----------|
| **1** | Inventory + safely integrate dirty paths (~50) | Agent | clean groups, no clobber | `main` has coherent commits; no half-live features |
| **2** | Production schema + auth roles verified | Agent (`apply-supabase-packs` / verify) | `DATABASE_URL` secret once | `--status` all needed packs OK; listener/artist/editor path smoke |
| **3** | Ship FAQ + finished WIP | Agent | 1 | `/faq` **200** live; Theme/brand/play-tracking as ready |
| **4** | Player: like + shuffle + repeat + error recovery | Agent | 1–3 optional | Phone: play, like, shuffle/repeat, auto-skip broken track |
| **5** | One payment → download proof | Agent + Abias keys if missing | Stripe/Paynow sandbox | One test order fulfilled without manual file hunt |
| **6** | Monitoring + error reporting | Agent | 2 helpful | Multi-route synthetic + daily digest; Sentry or agreed equivalent |
| **7** | One artist submit → approve → rotation → play count | Agent | 2, 4 | Real path on prod; play count moves |

**Out of Sprint 1 (explicitly next):** App/Play store submit, CapCut videos, Industry Watch publish batch, deep Lighthouse polish, Amuse-depth creator analytics, premium price/distributor.

### Dirty-tree ownership gate (before more feature work)

1. `git status` inventory → group by theme (auth, player, commerce, sql tools, brand, faq).  
2. Drop/quarantine temps (`.tmp-*.png`).  
3. Ship **vertical slices** (commit + deploy + live verify) — not one 50-file mega-PR.  
4. Concurrent agents: load `concurrent-agent-coordination`; no hard reset of foreign WIP.  
5. Do not start item 4–7 until FAQ/WIP ship path for item 3 is in progress or landed.

**SQL:** agent-first — `ops/SQL_APPLICATION_WORKFLOW.md`. Abias does **not** paste SQL routinely; only one-time `~/.openclaw/secrets/bvs-supabase-db.env`.

---

## 1. Where we are (honest baseline)

### What already shipped (since BVS rebuild era)

| Layer | Done (production / main) | Evidence |
|-------|--------------------------|----------|
| **Presence** | Domain live on Vercel; HTTPS; core pages 200 | Home ~0.5–0.6s TTFB today; routes `/radio` `/catalogue` `/upload` `/artists` `/community` etc. |
| **Listen** | Continuous rotation, album/project covers in player, progress bar, house + Wolfbridges content (~100 local MP3s scaffold) | Play verified earlier (readyState=4, range 206) |
| **Discover** | Catalogue, search, BeatStore surface, albums/singles pricing ($2 default), shop services | `/catalogue` `/shop` |
| **Auth** | Signup/login/reset; auth redirect hardened away from localhost | `auth-url` + `NEXT_PUBLIC_SITE_URL` fix |
| **Creator flywheel (code)** | Upload → private submit → editorial → publish/rotation; album release form; creator studio; artist requests; play tracking API | `releases` / editorial / creator studio commits |
| **Commerce (code)** | Cart/checkout, Stripe + Paynow webhooks, regional tax, server price normalization, WhatsApp fallback | `COMMERCE.md` |
| **Community / assist** | Live chat page + APIs; visitor FAQ chatbot | `/community`, `/api/chat` |
| **Mobile** | PWA manifest + SW; Capacitor shells; iOS TestFlight path / AASA Team ID; Play AAB artifacts | `MOBILE.md`, `ops/store-launch` |
| **Ops hygiene** | Direct-to-Supabase upload (no Vercel 413); brand logo; editorial RBAC bootstrap path; daily editorial research cron | Memory 2026-07-15…20 |

### Product vision locked (do not re-litigate)

From `PRODUCT_VISION_SUBMIT_ROTATION_DISTRO.md` (Abias 2026-07-21):

1. Foundation MP3s = **scaffold**, not forever rotation definition.  
2. Real growth = **artist album-shaped submit → editorial → publish → rotation**.  
3. Premium = monthly switch for **multi-platform distribution later** — **do not invent** distributor or price.  
4. On-site sell = rights we control (singles/albums/beats/services).

### Gaps that block “genuinely impressed”

| Gap | Why it hurts retention |
|-----|------------------------|
| **~46 dirty/untracked files** not cleanly shipped | Features half-live (e.g. `/faq` **404** while local page exists); brand/theme/WIP drift |
| **Auth role QA incomplete** | Vercel Security Checkpoint blocked automated browser QA; multi-role journeys unproven end-to-end |
| **SQL migrations uneven** | Creator workflows, wallet ledger, community chat, final-sprint core — must confirm **applied on production Supabase** |
| **Checkout → paid → download** not proven with real sandbox payments | Buyers abandon if pay works but file doesn’t (or opposite) |
| **Player delight incomplete** | Abias asked like / shuffle / repeat; library save exists but “radio feels pro” still shallow |
| **Creator dashboard still “basic”** | Amuse-style clarity (status cards, analytics, next action) not fully there |
| **Performance not productized** | No Lighthouse budget, no RUM dashboards, TTFB/cache uneven; large HTML shells |
| **No systematic bug discovery** | Relying on Abias + occasional customer noise; silent failures (playback_error events exist but not reviewed as a product loop) |
| **Stores not public** | TestFlight/AAB work advanced; mass discovery still web-only |
| **Content trust** | Industry Watch / events still research → not a polished published layer customers quote |

**Net:** Platform **shape** is strong. Trust loop (works every time + feels premium + grows catalogue) is the sprint.

---

## 2. North-star metrics (this sprint)

Pick numbers you can instrument with existing `trackEvent` + Supabase; refine after week 1 baseline.

| Metric | Definition | Sprint target |
|--------|------------|---------------|
| **Listen success** | `player_start` without `playback_error` within 10s | ≥ 98% sessions |
| **Session depth** | Median tracks played / visit | ≥ 3 |
| **Return D7** | Listeners with ≥2 sessions in 7 days | Baseline + upward trend |
| **Submit complete** | Album/single upload finishes without client error | ≥ 95% attempts |
| **Editorial SLA** | Submit → first review | ≤ 48h (ops) |
| **Checkout convert** | Cart start → `paid` or clear manual path | Measure first, then lift |
| **Silent bug catch** | Issues found by automation before user report | ≥ 70% of P0/P1 |
| **Core Web Vitals** | LCP / INP / CLS on `/` and `/radio` (mobile) | “Good” band on both |

---

## 3. Sprint structure

Name: **“Impress & Retain”**  
Cadence: ship **visible** improvements every 2–3 days; no mega-branch that sits dirty.

```
Sprint 1 (now) — Seven outcomes only (§0 table)
Sprint 2       — Performance polish, creator studio depth, content/CapCut, stores parallel
Sprint 3+      — Premium distro partner, deeper growth, editorial scale
```

Older “Week 1–3 seven workstreams” narrative is **superseded** by §0 for active work. Sections W0–W6 below remain as **backlog detail**, not a mandate to finish all in one sprint.

---

## 4. Workstreams (big tasks)

### W0 — Ship & stabilize (days 1–3) — **P0**

**Goal:** Production matches repo intent; no “ghost features.”

1. **Triage dirty tree**  
   - Commit/ship coherent groups: FAQ, ThemeToggle, play tracking, creator-workflows admin, brand assets, checkout/order hardening.  
   - Drop or quarantine temp screenshots (`.tmp-*.png`).  
2. **Production Supabase SQL workflow (agent-first)**  
   - **Agents apply:** `python3 scripts/apply-supabase-packs.py --apply-missing --yes`  
   - **Full process:** `ops/SQL_APPLICATION_WORKFLOW.md`  
   - **One-time Abias:** put `DATABASE_URL` in `~/.openclaw/secrets/bvs-supabase-db.env` (mode 600) — then no more “please run this SQL”.  
   - **Verify:** `python3 scripts/verify-supabase-schema.py --full`  
   - Packs: library-sync → analytics → editorial → **wallet** → releases → creator → community → final-sprint.  
3. **Auth E2E (manual + recorded)**  
   - Fresh signup → email confirm (not localhost) → profile → role.  
   - Listener / artist / editor / admin happy paths.  
4. **Vercel env checklist**  
   - `NEXT_PUBLIC_SITE_URL`, Supabase keys, Stripe/Paynow, Telegram order hooks, WhatsApp.  
5. **Deploy checkpoint**  
   - After each group: live URL verify (not just build green). Use `bvs-vps-release` skill.

**Exit:** `/faq` 200; no known half-deployed feature; schema checklist green.

---

### W1 — Listen experience that keeps people (days 2–10) — **P0**

**Goal:** First 30 seconds feel like a real station, not a demo.

| Task | Detail | Why |
|------|--------|-----|
| **Like / save from player** | Wire library favourites into bottom player + radio page | Requested; retention |
| **Shuffle / repeat modes** | Station modes: continuous rotation, shuffle, single-track repeat | Requested; control |
| **Now playing clarity** | Title, artist, project cover, next-up peek, clear buffering state | Trust when stream stalls |
| **Error recovery UX** | On `playback_error`: auto-skip + toast “Skipping broken track” + log | Silent broken tracks kill trust |
| **Cross-page continuity** | Home → radio → catalogue: same session track, no double-start glitches | Premium feel |
| **Mobile player polish** | Safe-area, lock-screen metadata (Media Session API), PWA install friction lower | Phone is primary device |
| **Rotation quality** | Prefer approved+published artist tracks when available; house content as fallback | Vision lock |

**Exit:** Phone user can open site, play in &lt;3s, like a track, return next day and find it in Library.

---

### W2 — Artist flywheel (credibility for creators) — **P0/P1**

**Goal:** Artist feels Amuse/Distro-lite on BVS, not a black hole form.

1. **Creator studio v2**  
   - Status pipeline UI: submitted → in review → approved/rejected → published → in/out rotation.  
   - Play totals + last 7 days when `track_play_events` live.  
   - Clear **next action** per release (“Fix metadata”, “Awaiting review”, “Share link”).  
2. **Role-gated tools**  
   - Show tools by approved roles (artist / writer / show creator); admin sees all.  
3. **Album submit reliability**  
   - Stress multi-track + cover; progress bars; resume after network blip.  
4. **Editorial ops**  
   - “New uploads waiting” badge/count; Telegram already exists — add dashboard counter + audit row.  
5. **Premium shell honesty**  
   - Keep “distribution when partner ready” copy; no fake DSP claims.  
6. **Onboarding assets**  
   - Ship `BVS_PROFILE_ONBOARDING_FORM` into real profile fields artists fill once.

**Exit:** One real external artist (or Abias as artist) completes submit → approve → hear track on `/radio` → see play count.

---

### W3 — Commerce that closes the loop — **P0**

**Goal:** Money path is boring and reliable.

1. **Paynow sandbox + Stripe test** end-to-end on production-like env.  
2. **Paid → download token** works without WhatsApp for digital goods when files exist under `bvsradio-products/`.  
3. **WhatsApp/email fallback** only when auto-fulfill fails — with owner Telegram.  
4. **Catalogue hygiene**  
   - No DEMO/DRAFT names in public paths (backend sprint started this).  
   - Clear “preview vs buy” for beats/singles.  
5. **Cart trust**  
   - Tax line already regional; show inclusive total plainly on mobile.  
6. **Empty/error states**  
   - Never dump raw provider errors to buyers (`DEPLOYMENT_SECURITY.md`).

**Exit:** One test purchase fully fulfilled without manual file hunting.

---

### W4 — Performance & polish (feel expensive) — **P1**

**Goal:** Site feels snappy on average Zimbabwe / EU mobile networks.

1. **Budgets**  
   - Lighthouse CI or manual weekly: `/`, `/radio`, `/catalogue`.  
2. **Frontend**  
   - Image sizes (Next/Image already partial); reduce redundant client JS; defer chatbot until interaction.  
3. **Audio delivery**  
   - Prefer Supabase Storage signed/CDN URLs for rotation when possible (Vercel byte-range history).  
   - Confirm Range 206 for all production audio hosts.  
4. **Caching**  
   - Static assets long-cache; HTML revalidate intentionally.  
5. **Theme**  
   - Ship ThemeToggle cleanly; brand grey logo consistent; light mode QA.  
6. **Accessibility**  
   - Player keyboard + ARIA; focus rings; contrast on light theme.

**Exit:** Mobile Lighthouse Performance ≥ 80 on `/` and `/radio` (or documented blockers only).

---

### W5 — Content & growth layer — **P1**

**Goal:** Reasons to return beyond one song.

1. Publish **Industry Watch / events** items from approved research (verify dates/sources; original BVS wording).  
2. FAQ live + linked in nav/footer/chatbot.  
3. Shows page not empty theater — at least schedule stubs or “coming up” with real process.  
4. Artist Instagram money post pack (from memory request) — marketing, not fake product.  
5. **CapCut launch video track** (Abias has CapCut) — parallel to engineering:
   - 15–30s launch intro (logo + real site screen record + rights-clear bed)
   - 45–60s “how to submit” for artists
   - Short “how to install PWA / listen” for phones  
   Export 1080×1920 + 1920×1080 → site embed + Reels/TikTok. Details in `SQL_APPLICATION_WORKFLOW.md` §9 / this section.  
   Does **not** block SQL or payments.

---

### W6 — Stores (parallel, Abias-gated) — **P1**

Does not block web impress sprint, multiplies reach.

| Track | Status | Next |
|-------|--------|------|
| **iOS** | TestFlight / screenshots advanced | Submit App Review when Abias ready |
| **Android** | AAB artifacts | Play Console pay + internal track |
| **Asset links** | Team ID on AASA | SHA-256 when Play signing known |

---

## 5. Bug discovery system (customers will not report everything)

Assumption: **most bugs die silently** (failed play, stuck checkout, empty chat, wrong tax). We need **instrumented discovery**, not hope.

### 5.1 Layers

```
A. Synthetic monitoring (always-on)
B. Real-user telemetry (privacy-aware)
C. Session + error capture (dev/QA + sampled prod)
D. Role dogfood scripts (scheduled)
E. Human wild QA (phone + low bandwidth)
F. Feedback micro-loop (in-product, low friction)
```

### 5.2 A — Synthetic monitoring (P0 this week)

Run from VPS cron (OpenClaw or systemd), every 15–30 min:

| Check | Pass criteria |
|-------|----------------|
| Home / radio / catalogue / checkout | HTTP 200 + max TTFB budget |
| Manifest + SW | 200 JSON/JS |
| Sample audio URL | 206 on Range request |
| Auth pages | 200, no localhost links in HTML |
| Checkout config API | 200 JSON with expected keys |
| Critical API health | No 5xx spike |

**Alert:** Telegram to Abias on **2 consecutive fails** (avoid flapping).  
**Store:** last 7 days in SQLite or Supabase `uptime_checks`.

Terry Simple already pings home UP/DOWN — **expand to multi-route + audio range**.

### 5.3 B — Real-user telemetry (already started)

Use existing `/api/analytics` + `trackEvent`:

| Event | Use |
|-------|-----|
| `player_start` | Funnel start |
| `playback_error` | **Daily digest** of broken tracks |
| `listening_duration` buckets | Engagement |
| `track_save` | Intent |
| `upload_complete` / failures | Creator friction |
| `payment_error` | Commerce friction |

**Add (small):**

- `checkout_start`, `checkout_success`  
- `auth_fail` (generic code, no passwords)  
- `api_client_error` for failed fetch on critical paths  
- Client `unhandledrejection` / `window.onerror` beacon (sampled)

**Daily Telegram digest (automated):**

```
BVS health 24h
- play success: 97.2% (12 errors)
- top errors: track X (4), track Y (3)
- uploads: 3 ok / 1 fail
- checkout errors: 0
- 5xx: 2 (route …)
```

### 5.4 C — Error + optional session insight

| Tool | Role |
|------|------|
| **Sentry** (or similar) on Next.js | Stack traces for API/player; release tagging with Vercel deploy id |
| **Vercel logs** + log drain | Server 5xx |
| **Optional** PostHog/LogRocket later | Session replay only if privacy policy updated + consent |

Start with **Sentry + analytics digest**; replay is optional week 3+.

### 5.5 D — Role dogfood scripts (scheduled, not only manual)

Nightly Playwright (or agent-browser) against production **with test accounts**:

1. Listener: login → play 30s → like → library  
2. Artist: login → open studio → prepare release (dry run without huge file if needed)  
3. Editor: login → editorial queue loads (not access loop)  
4. Guest: home → chatbot one FAQ → contact  

Store screenshots under `ops/qa/latest/`; Telegram only on **diff/fail**.

**Note:** Vercel Security Checkpoint blocked earlier automation — whitelist QA IP or run from allowed browser profile / residential path.

### 5.6 E — Human wild QA

Every Friday 20 min:

- Real phone on mobile data (not only Wi‑Fi)  
- Low-end Android if available  
- Safari iOS install PWA  
- One full checkout sandbox payment  

Checklist lives in `ops/qa/FRIDAY_WILD.md` (create with sprint start).

### 5.7 F — In-product micro-feedback

Do **not** rely on “email us bugs.”

- After 2nd track: soft “Sound ok?” → Yes / Skip / Issue  
- On playback error after auto-skip: silent log + optional “Report this track”  
- Checkout fail: “Copy error ID” (correlation id)  

Low noise, high signal.

### 5.8 Severity & response SLA

| Severity | Example | Response |
|----------|---------|----------|
| **P0** | Site down, all audio 4xx/5xx, auth totally broken | Fix within hours; Telegram page |
| **P1** | Checkout broken, upload 413/500, editorial loop | Same day |
| **P2** | UI glitch, single bad track, copy | Next ship |
| **P3** | Polish | Backlog |

**Rule:** Agents never close P0/P1 on “build succeeded” alone — need **user-visible verify**.

---

## 6. Sprint backlog (ordered)

### Must complete this sprint

1. Ship dirty WIP + FAQ live  
2. Supabase production schema green checklist  
3. Auth multi-role E2E  
4. Player: like + shuffle + repeat + recovery  
5. Payment sandbox + digital fulfill proof  
6. Synthetic multi-route + audio monitor + Telegram alerts  
7. Daily analytics/error digest  
8. One real submit → rotation → play count story  
9. Performance pass on `/` + `/radio`  
10. Sentry (or equivalent) on production  

### Should complete

11. Creator studio status clarity  
12. Editorial “waiting” badge  
13. Theme polish + light mode QA  
14. Industry Watch first published batch  
15. Expand Terry → full synthetic suite  

### Nice / parallel (Abias calendar)

16. App Store submit  
17. Play internal testing  
18. Premium price decision (business — not invent)  
19. Distributor partner talks (business)  
20. Company/BAZ legal track (founder pack — parallel, not code blocker)

---

## 7. Definition of Done for “customers genuinely impressed”

A cold visitor on phone can:

1. Land on home, understand BVS in 5 seconds.  
2. Hit play, hear music, see real cover/title.  
3. Save a track; return later and find it.  
4. Browse catalogue without broken media or fake video promises.  
5. Sign up without localhost / dead email links.  

An artist can:

6. Submit an album-shaped release with progress feedback.  
7. See status without guessing.  
8. Hear approved work on the station.  
9. Request a change and see it acknowledged.  

A buyer can:

10. Pay (or clear EcoCash path) and receive the product.  

Ops can:

11. Learn about most P0/P1 issues **before** a human complains.  

---

## 8. Risks & decisions needed from Abias

| Decision | Why |
|----------|-----|
| Confirm production SQL already applied (list) | Blocks creator/wallet/chat truth |
| Paynow + Stripe test credentials ready? | Commerce DoD |
| OK to add Sentry (or pick preferred error product)? | Bug discovery |
| Test artist + editor accounts for dogfood | Automation |
| App Store submit timing | Parallel track |
| Premium price / distributor: still TBD (OK) | Keep shell honest |

---

## 9. First 48 hours execution plan (if greenlit)

1. Schema verify script against prod (read-only).  
2. Ship FAQ + ThemeToggle + play tracking if migrations ok.  
3. Stand up synthetic monitor v1 (home, radio, catalogue, audio range).  
4. Player like/shuffle/repeat PR.  
5. Stripe/Paynow test matrix doc with one successful paid path.  

---

## 10. Related docs

- `ops/PRODUCT_VISION_SUBMIT_ROTATION_DISTRO.md` — product law  
- `ops/bvs-backend-priority-sprint.md` — last backend pass  
- `ops/store-launch/FULL_LAUNCH.md` — stores  
- `COMMERCE.md` · `MOBILE.md` · `DEPLOYMENT_SECURITY.md`  
- Skill: `bvs-vps-release` · runbook: `RUNBOOK_VPS_WEB_RELEASES.md`

---

*Plan prepared 2026-07-23 after live probe + git/ops/memory audit. Next step: Abias prioritizes W0–W3 or edits targets; agents execute with user-visible verification.*
