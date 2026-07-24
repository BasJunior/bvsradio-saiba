# BVS Producer BeatStore — implementation plan

**Source:** Discord DM 2026-07-24 (BasJunior)  
**Status:** active plan; Sprint 1 #5 live proof parked until more of this lands

## Goal
Approved producers upload, price, and manage beat licences from Creator Studio. Published beats appear in Browse BeatStore, search, and the producer’s public catalogue.

## Producer workflow
1. Creator Studio → **My BeatStore**
2. Upload preview audio, WAV master, artwork, optional stems
3. Title, description, genre, mood, BPM, key
4. Licence tiers + prices
5. Draft or submit for editorial review
6. On approval → publish to BeatStore + producer page

## Licence options (templates TBD — do not invent legal terms/prices)
- MP3 Lease, WAV Lease, Trackout/Stems, Unlimited, Exclusive, Custom Quote
- Snapshot price + terms at purchase

## Data model (dedicated, not overloaded tracks)
- `beats`, `beat_licence_options`
- Supporting: `beat_orders`, `beat_order_items`, `beat_licence_grants`, `beat_downloads`, `beat_sales_events`

## Delivery phases
1. **Marketplace MVP** — producer access, uploads, one standard licence, editorial publish, live producer catalogues
2. **Commerce** — multi-tier, payments, secure downloads, licence PDFs, producer earnings/wallet
3. **Growth** — analytics, favourites, discounts, advanced filters, storefront customisation

## Security / editorial
- Direct-to-Supabase signed uploads; masters/stems private
- Only tagged previews + artwork public
- Producers only manage own listings; editorial required for publish
- Exclusive becomes unavailable after sale

## Build order when executing
Phase 1 identity/permissions → Phase 2 schema → Phase 3 dashboard → Phase 4 uploads → Phase 5 public page → Phase 6 checkout/delivery
