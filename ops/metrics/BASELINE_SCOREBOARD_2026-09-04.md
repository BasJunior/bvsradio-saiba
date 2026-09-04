# BVS Baseline Scoreboard — 2026-09-04 (Europe/Berlin)

Live prod: bvsradio.com · deploy ae02401 · control/vNext artist-proof slice  
Source: Supabase `rdwwyolrxahimcgpkzzy` (direct SQL)

## 1. People
| Metric | Value |
|--------|------:|
| Auth users / profiles | 168 |
| Artists | 97 |
| Listeners | 70 |
| Writers | 1 |
| Producers (`is_producer`) | 45 |
| Signups 7d | 6 |
| Signups 30d | 136 |
| `premium_active` flag on profiles | 5 |
| Active editorial staff | 5 (founder, admin, editor, programmer, commerce_manager) |

## 2. Catalogue / editorial
| Metric | Value |
|--------|------:|
| Releases total | 8 |
| Approved + public + in rotation | 8 / 8 / 8 |
| Editorial backlog (submitted/in_review) | **0** |
| Releases 7d / 30d | 1 / 6 |
| Tracks total | 129 |
| Approved + public | 92 |
| In rotation | 72 |
| Rejected | 34 |
| Tracks 7d / 30d | 9 / 67 |
| Open track review requests | 0 (19 resolved) |
| Oldest backlog age | n/a (empty) |

## 3. Listening
| Metric | Value |
|--------|------:|
| Sum `tracks.play_count` | 3,386 |
| `track_play_events` all / 7d / 30d | 3,393 / 240 / 2,481 |
| Play events 30d by source | station 2,481 |
| Approved public with play_count=0 | **6** (none of these are in_rotation) |
| In-rotation zero-play | **0** |

### Analytics events (30d)
| Event | Count | Sessions |
|-------|------:|---------:|
| player_start | 3355 | 517 |
| playback_error | 2376 | 352 |
| listening_duration | 1597 | 359 |
| queue_play_now | 562 | 221 |
| search_no_results | 155 | 68 |
| track_save | 124 | 54 |
| upload_complete | 40 | 36 |
| checkout_started | 20 | 8 |
| checkout_redirect | 10 | 7 |
| payment_error | 9 | 1 |
| checkout_complete | 8 | 3 |

**Red flag:** `playback_error` ≈ 71% of `player_start` volume (session overlap high). Needs investigation after money-path.

### Top approved public tracks
Heavy 166 · Thugging 148 · On the Moon 148 · Mahendere 124 · Party Tarpy 120 · Jegera 112 · Zororo 109 · To the Moon 104

### Zero-play approved public (not in rotation)
- kniightcrawler: BOTTEGAH, UPP (FREESTYLE), SPOOKY BENJAMINS, SKIT (2026-08-14)
- santa.maria: handiregi (2026-08-28)
- TwoKayBlur: Daily Bread (2026-08-28)

## 4. Money / memberships
| Metric | Value |
|--------|------:|
| Active memberships | 3 (2× artist_founding, 1× artist_standard) |
| Founding seats used | 2 |
| Orders total | 32 |
| Paid orders | **2** (lifetime paid total **$13.76**) |
| Pending payment | 30 ($626.86 stuck intent) |
| Orders 30d / paid 30d | 21 / 2 |
| Paid 30d total | $13.76 |
| commerce_payment_events | 2 (Stripe $4.76 + Paynow $9.00, both verified+reconciled) |
| artist_deposits | 0 |
| artist_ledger_entries | 12 |
| creator_service_orders | 0 |
| marketplace booking requests | 0 |

### Paid orders
1. `BVS-PREM-20260818-ZVSJQ` — Paynow $9.00 — abias93@gmail.com — 2026-08-18
2. `BVS-20260807-9MLIC` — card/Stripe $4.76 — abiasjnr@gmail.com — 2026-08-07

### Schema note
- No `wallet_transactions` table (do not query it).
- Money tables that exist: `orders`, `commerce_payment_events`, `commerce_order_items`, `artist_deposits`, `artist_ledger_entries`, `bvs_memberships`.

## 5. Business read
**Working**
- Audience + listening loop is real (3k+ starts, station plays).
- Rotation catalogue is live and all in-rotation tracks have plays.
- Editorial queue is clear (no backlog).
- Auth/control slice is up on prod (ae02401).

**Weak / blocked for “business proof”**
- Conversion is tiny: 8 checkout_complete / 3 sessions → 2 paid orders lifetime.
- 30 pending checkouts vs 2 paid → funnel leak (Paynow live mode? abandoned carts? webhook gaps).
- playback_error storm may be killing perceived quality.
- No service orders / bookings yet; deposits empty.
- Only 3 artist memberships; founding 2/50.

## 6. Next checklist (agreed order)
1. ~~Baseline scoreboard~~ ✅ 2026-09-04
2. **#4 Money-path proof** — one real payment/download/booking E2E + reconcile against `orders` + `commerce_payment_events` + membership/ledger
3. Share/live proof polish (no fresh submit required)
4. Reactivation list 5–10 artists (no outreach until message approved)
5. Deferred: manual artist activation, editorial 48h SLA ownership, full approve→publish→rotation run
6. Native vNext still blocked pending isolated backend + device gates

