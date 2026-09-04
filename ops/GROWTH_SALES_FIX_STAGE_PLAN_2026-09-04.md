# BVS Growth & Sales Fix — Stage-Correct Plan (2026-09-04)

**Stage:** listening traction, **pre-commerce PMF**, thin real catalogue, founder-only order book  
**North star:** Zimbabwean musician full music economy (submit → publish → rotation → commerce → premium distro)  
**Not the goal:** order hygiene, deploy theatre, broad funnel CRO

## 0. Stage diagnosis (what pros would say)

| Signal | BVS now | Stage label |
|--------|---------|-------------|
| Listen | ~3.3k player_start / 30d, station plays real | Soft engagement |
| Catalogue depth | 8 releases, 72 in rotation, many scaffold | Supply incomplete |
| Artists | 97 profiles, few with real releases | Signups ≠ supply |
| Commerce | 0 external orders; 0 download_count | No demand entered funnel |
| Checkout | Founder can pay (2 self-paid) | Plumbing OK enough to sell |

**Professional rule at this stage:**  
Do **not** optimize conversion rate on a funnel with **zero external entries**.  
Optimize **reason to pay**, **who pays**, and **one forced successful path** from real humans.

Classic mistake: A/B test checkout while nobody has a reason to open it.

---

## 1. What successful companies do at this stage

### Do
1. **Narrow the wedge** — one customer, one offer, one proof  
2. **Concierge the first 10 sales** — founder/ops closes manually if needed  
3. **Fix core product trust** — broken play = no brand, no buy  
4. **Activate supply that already has fans** — not cold “all 97 artists”  
5. **Put the offer where intent already is** — now playing / artist page / share card  
6. **Measure only leading indicators of the wedge** — not vanity dashboards  
7. **Separate listener $ vs artist $** — different motions

### Don’t
1. Broad paid UA to “the app” with no offer  
2. Rebuild marketplace / multi-SKU complexity  
3. Clean 30 test pending orders as a growth project  
4. Invent distributor brand to sell Premium  
5. Wait for perfect Paynow before talking to humans  
6. Treat 97 artist signups as GTM done

---

## 2. Two revenue motions (keep separate)

### Motion A — Fan money (listener → pay)
**Job:** turn love of a track/artist into a purchase or tip-like support.  
**Offers that work next to free stream:**
- Buy/download (own it / support)
- Name-your-price / support artist
- Beat licence (producer path)
- Booking request deposit
- Exclusive / early / merch later

**BVS wedge (recommended):**  
**“Support / Buy this track” on top played rotation tracks** + artist page CTA.

### Motion B — Artist money (musician → pay BVS)
**Job:** artists pay for career infrastructure.  
**Offers:**
- Premium (distribution entitlement when partner exists; studio tools now)
- Founding seats (scarcity, status)
- Later: payout, rights passport packaging

**BVS wedge (recommended):**  
**Reactivate 5–10 real artists** → live release on BVS → Premium pitch only after they’re live and proud.

**Sales fix priority:** Motion A creates proof fans pay; Motion B scales the economy.  
Right now **both are empty externally**. Start with **whichever you can close in 14 days with humans you already know**.

---

## 3. 14-day professional sales fix (implementation)

### Week 1 — Make buying possible in the wild

| # | Action | Owner | Done when |
|---|--------|-------|-----------|
| 1 | **Pick 5 hero SKUs** from top plays (Heavy, Thugging, Mahendere, etc.) | Saiba + Abias | 5 tracks with clear price + cover + artist |
| 2 | **Single obvious CTA** on player + track/artist: Buy / Support | Eng | Visible on mobile web without digging |
| 3 | **One checkout path only** (Stripe *or* Paynow, not 6 methods in UI) | Eng | External tester completes pay once |
| 4 | **Receipt + order visible** to buyer email; status `paid` in DB | Eng | Reconcile script/check green |
| 5 | **playback_error triage** top causes (range/CDN/codec/autoplay) | Eng | Error/start ratio trend down |
| 6 | **Internal test orders excluded** from “sales” scoreboard | Ops | Scoreboard = external only |

### Week 2 — Force first external demand

| # | Action | Owner | Done when |
|---|--------|-------|-----------|
| 7 | **Artist reactivation list 5–10** (real musicians, not empty profiles) | Abias | List + approved message |
| 8 | **Concierge sell:** DM/call 10 fans or 5 artists’ circles — “buy this to support” | Abias | First external paid order |
| 9 | **Share cards** with buy link (WhatsApp/IG) for hero tracks | Eng + Abias | Shares produce sessions with checkout_started |
| 10 | **Artist pack:** “you’re live on BVS — here’s how fans pay you” | Ops | 1-pager / studio empty-state |
| 11 | **Premium only after live release** pitch | Abias | No Premium spam to dead accounts |
| 12 | **Weekly scoreboard** external-only: checkout_started, paid, $ , artists with ≥1 public release | Saiba | Every Mon |

**Success bar (professional, not vanity):**  
- **≥3 external paid orders** in 14 days **or**  
- **≥5 artists** with a real public release fans can find **and** ≥1 external checkout_started  

If neither moves, problem is still offer/audience, not code.

---

## 4. Growth strategy by horizon

### Now (0–30 days) — “First dollars from real people”
- Concierge sales + hero SKU + reliable play  
- Reactivate supply  
- Instrument external commerce only  
- **No** scale spend

### Next (30–90 days) — “Repeatable path”
- Artist-led share loops (every publish pings artist with share/buy kit)  
- Beats lane if producers convert faster than song downloads  
- Founding Premium filled with **live** artists only  
- Editorial SLA only when backlog appears  
- Light content/SEO around ZW artists who are actually live

### Later (90+ days) — “System”
- Distribution partner (still never invent)  
- Rights passport / ledger as trust moat  
- Marketplace bookings when supply is real  
- Paid UA only when CAC < LTV on a known offer

---

## 5. Implementation backlog (engineering, ordered)

**P0 — sales unblocking**
1. Player chrome: Buy/Support always visible for priced tracks  
2. Collapse checkout to one primary method + honest pending state  
3. Post-pay success page that doesn’t look broken  
4. playback_error logging → top 3 fixable causes  
5. External sales metric view (exclude abias* emails + known test aliases)

**P1 — supply unblocking**
6. Creator Studio empty state: submit first release in <10 min path  
7. “You’re live” share kit after approve  
8. Reactivation CRM list export (username, email if allowed, last active, has_release)

**P2 — economy depth**
9. Support artist (simple tip) if download feels wrong next to free stream  
10. Booking request with deposit  
11. Beat licence purchase path polish  

**Explicit non-goals this stage**
- Order table cleanup project  
- Multi-currency expansion  
- Full marketplace redesign  
- Native sales features before web wedge works  
- Distributor marketing copy

---

## 6. Sales process (human) — how pros close first revenue

1. **Choose ICP this month**  
   - Either: fans of BasJunior / Calm Beast / rotation heads  
   - Or: 5 Zimbabwe artists with existing IG/WhatsApp audiences  
2. **Script (fan):** “Track is free to hear on BVS. If you want to support X, buy here — $Y. Takes a minute.”  
3. **Script (artist):** “Your music can be live on BVS this week. Fans hear full tracks. We add Buy/Support on your page. Premium is optional after you’re live.”  
4. **Close in chat** — send deep link, stay on until paid, fix friction live  
5. **Log** every attempt: who, link, blocker, paid Y/N  
6. **Only then** automate what worked

Founders who wait for “the site to sell itself” at 0 external checkouts wait forever.

---

## 7. KPIs that matter (replace vanity)

| KPI | Why |
|-----|-----|
| External paid orders / 7d | Real sales |
| External checkout_started | Demand entered |
| Artists with ≥1 approved public release | Real supply |
| Releases published / 7d | Economy motion |
| playback_error / player_start | Trust |
| Share → session → play | Distribution of attention |
| Premium actives among artists **with** live release | Honest artist $ |

**Ignore for growth decisions:** total pending $ from founder tests, total artist role count, deploy count.

---

## 8. Recommended decision for Abias (one path)

**Default professional package (next 14 days):**

1. **Hero commerce wedge** on top 5 played tracks (Buy/Support + one payment rail)  
2. **playback_error** hard triage  
3. **5–10 artist reactivation** (message approved by you first)  
4. **You personally close first 3 external pays** via WhatsApp/IG using those links  
5. Scoreboard external-only weekly  

Skip until after first external pay: test-order tagging, money-path self-reconcile theatre, native sales, broad Premium campaigns.

---

## 9. Tie-back to main goal

Every sales fix must strengthen:

`real artist → live on BVS → fans hear → fans can pay → artist sees money/rights path → Premium/distro later`

If a task doesn’t move that chain, it’s not growth — it’s maintenance.
