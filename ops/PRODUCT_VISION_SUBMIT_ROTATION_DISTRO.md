# BVS Radio — Submit → Publish → Rotation → Premium distribution

**Status:** product vision + implementation direction (2026-07-21)  
**Audience:** OpenClaw / Saiba / Grok Build / any BVS agent  
**Rule:** Do **not** invent **distributor names** or **pass-through licence fees**. Artist Premium **list prices** were set in the 2026-07-28 financial plan (Founding / Standard) — use those on the site. Build billing so partner costs can still be plugged in later.

---

## 1. What the foundation library is

Tracks under `public/music` (and early static catalogue rows) were used to **construct and prove the site**: player, covers, catalogue, commerce UX.

They are **scaffold / house content**, not the long-term definition of continuous rotation.

Long-term rotation and catalogue growth come from **real artist profiles submitting structured releases**, then **editorial approval + publish**.

---

## 2. Intended artist path (canonical)

Imagine Wolfbridges has a BVS artist profile and submits **3 albums**.

```
Artist account (role artist)
  → Structured submission (album/EP model, like Dropbox Spotify-shaped packs)
       • project/album title
       • cover art
       • ordered tracks + audio files
       • credits / features
       • rights confirmation
  → Editorial review (submitted → in_review → approved | rejected)
  → Publish on BVS (is_public / catalogue visibility)
  → Continuous rotation (in_rotation) so listeners hear full tracks on BVS
  → Optional: sell singles ($2 default) / full album packages on BVS
  → If premium artist subscription active:
       → Distribution entitlement ON
       → distribution_jobs: eligible → queued → submitted → live_on_dsp
       → Hand-off via **private** DSP partner (internal code only; not a public brand)
       → After partner/store approval → Spotify / Apple / Boomplay / etc.
  → If not premium:
       → BVS listen + on-site commerce only (no auto multi-platform publish)
```

### User story (Premium artist — full path)

> As a **Premium artist**, I upload a song to BVS. After **BVS editorial approval**, it is **live on BVS Radio**. BVS then queues **multi-platform distribution** through a **private partner** (not named in the product UI). When that partner and the stores approve the release, the same song is **live on Spotify and other major platforms**. Studio shows my path status the whole way.

Implementation spine: `src/lib/distribution-path.ts` · Studio `/creator/studio#release-path` · editorial `distribution_jobs` controls · publish hook in `releases-server.ts`.

Dropbox album folders Abias provided are the **UX/data shape reference** for “how submit should work,” not merely static Spotify deep-links.

---

## 3. Product layers (keep separate)

| Layer | Purpose |
|--------|---------|
| **Listen (continuous rotation)** | Public streaming of **approved + published** (and rotation-flagged) tracks |
| **Catalogue / shop** | Discovery + **BVS sales** ($2 singles, album packages, beat licences) |
| **Submit + editorial** | Rights-gated intake and quality control |
| **Premium subscription** | Monthly entitlement; **unlocks distribution path** when licences/partners exist |
| **Distributor / DSPs** | External publish to Spotify etc. — **partner TBD**, not hard-coded |

Do **not** mix “stream-only YouTube/Spotify discovery stubs” with “we sell download rights” for titles we do not control.

---

## 4. Premium (what we know / what we do not)

**Known**

- Premium is a **monthly** cost to the artist.
- Premium is the commercial switch for **multi-platform distribution**, not only site tools.
- Monthly price will be set later from:
  - cost of **licences / regulatory** (company, BAZ/webcast class as applicable, tax, etc.)
  - cost of **distributor / partner**
  - other **business factors** (margin, support, currency)

**Artist Premium list prices (locked 2026-07-28 plan)**

| Tier | Monthly | Yearly | Notes |
|------|---------|--------|--------|
| **Founding Premium** | **US$9** | **US$90** | First 25–50 artists |
| **Standard Premium** | **US$12** | **US$120** | After founding / cost validation |

Source of truth in code: `src/lib/premium-tiers.ts` · public page `/premium`.

**Still unknown — do not invent**

- Named distributor (DistroKid, CD Baby, TuneCore, label partner, custom, …)  
- Distributor **pass-through** fees (keep separate from Premium list price)  
- Contract terms, territories, exclusive vs non-exclusive  
- Whether premium is required for BVS rotation (default vision: **rotation is after BVS publish**; premium is for **off-platform**)

When partner details arrive: update this doc + billing only; **data model should already have** `premium_active`, `distribution_enabled`, `distributor_id` (nullable).

---

## 5. Company / rights / BAZ — scope of what may be possible (from sessions)

From OpenClaw/Telegram work and the founder governance pack (not legal advice):

### Company
- Long-term monetisation (shop, artist relationships, ads, digital products, media) points to a **registered Zimbabwe entity**.
- Options discussed: **PBC Premium** package vs **PLC** quote; company formations intermediary.
- **Trade name** “BVS Radio” / brand filings (abbreviations may be restricted on legal names — trade name path discussed).
- **ZIMRA** tax registration / clearance as part of operating legitimately.

### BAZ / webcasting
- Online radio / streaming more naturally maps to **Webcasting / On-Demand** class discussion than free-to-air spectrum licences.
- Agents should treat BAZ as **confirm classification + licence path with authority**, not assume FM radio rules.
- Until licences are confirmed, **do not** claim BVS is a licensed terrestrial broadcaster.

### ZIMURA / collecting societies
- Music publishing / public performance / mechanical rights may involve collecting societies; **recordkeeping and enquiries** were flagged in founder materials.
- Exact obligations **TBD** with professionals.

### Rights on the platform
- Submit requires **rights confirmation** (artist owns/controls recording + composition clearance as needed).
- BVS rotation = licence to stream on BVS under terms (platform T&Cs).
- $2 single / album sale = **personal download** terms unless a separate licence product (beats already “licence starting point”).
- **DSP distribution** only under premium + distributor agreement + rights that allow multi-territory digital release.

### What this implies for product build
- Implement **submit → editorial → publish → rotation → optional premium distribution flag** **now**.
- **Placeholder** UI: “Premium: multi-platform distribution when available — partner and price announced later.”
- When licences + partner exist: fill pricing and “we use X distributor” without rebuilding the pipeline.

---

## 6. Systematic implementation order (no blocker on BAZ)

1. **Artist profile** as home for releases (already partially there).  
2. **Album/EP submission** (multi-track + cover + metadata) — upgrade beyond single-file upload.  
3. **Editorial** approve/reject/notes; publish flags.  
4. **Continuous rotation** = published + `in_rotation` (plus temporary house/foundation set if needed).  
5. **Commerce** $2 singles / album packages for hosted rights.  
6. **Premium subscription** entity (monthly billing stub or Stripe product when ready).  
7. **Distribution job queue** (release ready for distro; status: pending_partner / submitted / live_on_dsp) — partner empty until chosen.  
8. **Compliance copy** soft until BAZ/ZIMRA confirmed; no overclaim.

### Implemented in code (2026-07-21)

| Piece | Location |
|--------|----------|
| SQL | `supabase-releases-pipeline.sql` — **run in Supabase** |
| Album submit UI | `/upload` → **Album / EP release** tab |
| APIs | `/api/releases/prepare`, `/api/releases` |
| Editorial releases | Admin → Editorial top panel; `publish_release`, `reject_release`, rotation + distro job actions |
| Rotation | `station-library.ts` — approved `in_rotation` first, then house set; daily shuffle |
| Premium shell | `/artist/premium` + `/api/artist/premium` (`BVS_PREMIUM_MONTHLY_USD` optional env) |
| Commerce | `$2` singles already in `catalogue-pricing.ts` |

**Human step required:** paste/run `supabase-releases-pipeline.sql` in Supabase SQL editor once.

---

## 7. Agent rules

- Foundation MP3s: OK for demos; prefer describing long-term rotation as **artist-published catalogue**.  
- Never invent distributor brand or premium price.  
- Never claim BAZ licence held unless Abias confirms.  
- Rights: prefer verify over assumptions; keep legal disclaimers.  
- Skills: `bvs-vps-release` for deploy; this doc for product intent.

---

## 8. Related files

- Repo: `/home/admin/.openclaw/workspace/bvsradio`  
- Founder paperwork guide: `workspace/bvs-founder-governance-guide.{html,pdf}`  
- Upload/editorial code: `/upload`, `/api/tracks/upload`, `/admin/editorial`  
- Rotation: `src/lib/station-library.ts`, `music-projects.ts`  
- Pricing: `src/lib/catalogue-pricing.ts`  
