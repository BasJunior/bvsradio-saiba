# Pricing / product policy — owner decision memo (2026-08-28)

**Planning task:** DONE  
**Implementation of any price/share change:** DEFERRED BY OWNER BUSINESS DECISION  
**Live pricing was not changed.** `LIVE_PRICING_OR_PAYMENT_CHANGE_APPROVED=NO`

## What is LIVE on production (eb80df4)

From `src/lib/premium-billing.ts` + artist premium UI:

| Plan | Monthly | Yearly | Notes |
|------|---------|--------|-------|
| Artist Standard | US$12 | US$120 | Live |
| Artist Founding | US$9 | US$90 | Grandfathered; window ended 2026-08-27 |
| Instant $5.99 | — | — | **Not live on this production SHA.** Exists on beta / proposed catalogue |

Payment rails: Paynow + card (Stripe) on checkout. Zimbabwe practicality is a product advantage; do not silently swap economics.

## Proposed (not implemented)

Previous discussion, **not activated**:

- Instant ~ $5.99 / release
- Premium ~ $12 / month with 0% BVS master share
- Instant possible BVS master share
- Avoid high subscription **and** high royalty share without extra value
- 3 months Premium unlocking Instant to 100% artist share (beta concept)

## Recommendation

Keep live Standard at $12/month until you explicitly approve a written matrix (Instant price, lapse behaviour, royalty bps, founding remaining). Revenue that matters first: Premium + BeatStore + services, not distro take.

Owner actions remaining: say YES/NO to Instant on production, and YES/NO to any royalty-share change. No engineering TODO until then.
