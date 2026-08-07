# BVS Premium membership family (2026-08-06)

**Status:** implemented catalogue + public UI + memberships schema pack  
**Public:** https://bvsradio.com/premium  
**Artist desk:** https://bvsradio.com/artist/premium  
**API:** `GET /api/premium/catalog` · `GET/POST /api/artist/premium`

## Positioning

> Your music lives on BVS Radio. Premium takes approved releases to the major platforms. BVS Store tools help creators earn directly from their work.

## Spine (do not break)

Submit → editorial publish → BVS rotation & on-site sell → **Artist Premium** ships approved releases wider.

- Listening free forever  
- No paid editorial / rotation / charts  
- Artist Founding **$9/$90** and Standard **$12/$120** locked (28 Jul plan)  
- Other role prices = **pilot** until billing + ops proven  

## Code

| Piece | Path |
|--------|------|
| Catalogue | `src/lib/premium-catalog.ts` |
| Public page | `src/app/premium/page.tsx` (role tabs) |
| Catalog API | `src/app/api/premium/catalog/route.ts` |
| Artist shell | `src/app/api/artist/premium/route.ts` |
| Schema | `supabase-premium-memberships.sql` (pack `premium-memberships`) |

## Producer live-beat limits (growth era · 2026-08-06)

| Plan | Live-for-sale limit | Fee |
|------|---------------------|-----|
| Producer Store Free | **25** | 15% |
| Producer Plus | **150** | 8% |
| Producer Pro | unlimited (fair-use) | 3% |

- Count = `is_public` + `status=published` only (drafts / in-review do not count)
- Soft warn ≥80% usage; hard block only **new** go-live at 100%
- Existing live beats are never auto-removed
- Helper: `src/lib/producer-entitlements.ts` · gate on editorial `publish_beat`

## Next (not fully this ship)

1. Paynow subscription charge + founding seat counter  
2. `distribution_jobs` hand-off for entitled + approved releases  
3. Full commission ledger on BeatStore sales (bps already in entitlements)  
4. Supporter content that never buys editorial  
5. Team / Service / Curator / Brand only after 1–3  

## Guardrails

- Do not name aggregator brands in public UI  
- Separate mix/master, beat licences, promo campaigns from membership SKUs  
- Zimbabwe: Paynow-first local billing; Stripe only via supported entity  
