# After-review: Paynow Premium missed activation

**Status:** data-only backfill done 2026-08-18 14:42 Europe/Berlin. Code fix still queued after Apple Review. Do **not** deploy.

## What happened

Paynow took a real EcoCash payment. BVS never stored the order, so the webhook 404’d and Artist Premium never switched on.

| Field | Value |
|---|---|
| Paid at | 2026-08-18 14:16 Europe/Berlin |
| Merchant ref | `BVS-PREM-20260818-ZVSJQ` |
| Paynow | `58282823` |
| EcoCash | `MP260818.1416.T4651398` |
| Amount | USD 9.00 |
| Customer | Abias Chivayo snr / `abias93@gmail.com` / 772212468 |
| BVS account | CalmBeast (`e8e72baf-49f8-4846-8f69-08321ea31fcc`) |
| Merchant mail | `abiaschivayo@gmail.com` (Paynow, not BVS) |

Live BVS at report time:

- No `orders` row for `BVS-PREM-20260818-ZVSJQ` (no `BVS-PREM-*` rows at all)
- No `commerce_payment_events` row
- CalmBeast `premium_active = false`, no membership
- Founding seats still **1 / 50** (BasJunior Stripe $0 trial, 2026-08-08)

## Why

`src/app/api/artist/premium/subscribe/route.ts` still redirects to Paynow if `saveOrderLocal` / `saveOrderToSupabase` throws.

`src/app/api/webhooks/paynow/route.ts` then `loadOrder(reference)` and returns **404** if the row is missing. Activation, seat increment, BVS receipt, and owner Telegram never run.

Vercel local `data/orders` is throwaway. Durable path is Supabase only.

## Review-safe vs not

| Action | Affects Apple Review? | Now? |
|---|---|---|
| `vercel --prod` / push API+UI | **Yes.** iOS Capacitor loads live `bvsradio.com`. Tree is dirty (`account`, `layout`, `creator/studio`) and `main` is behind 40. | **No** |
| Manual DB backfill (order + membership + seat 2/50) | **No website deploy.** Page count would change 1 → 2. Does not touch Join/signup/login/player/`/app/ios`. | Only if Abias says **activate now** |
| Code fix after approval | Needed so the next paid Paynow cannot vanish | After review |

## After-review job (do in this order)

1. Re-confirm Paynow `58282823` is still **Paid** (not reversed).
2. Insert missing `orders` row for `BVS-PREM-20260818-ZVSJQ` (CalmBeast user id, `abias93@gmail.com`, paynow, $9, item `artist_premium` / founding / month, status `paid`).
3. Call the same path as `activatePaidArtistPremium`:
   - user `e8e72baf-49f8-4846-8f69-08321ea31fcc`
   - plan `artist_founding`, interval `month`, provider `paynow`
   - reference `BVS-PREM-20260818-ZVSJQ`
   - amount `9`
   - ends_at = paid_at + 1 month
4. Founding counter `artist_founding_seats_used` must become **2**.
5. Send BVS customer receipt + owner notify (current Stripe Premium path is also silent — fix that in the same pass).
6. Code: **do not redirect to Paynow unless the Supabase order save succeeded**. Return 500/retry instead.
7. Optional: if webhook 404s a `BVS-PREM-*` that Paynow later confirms paid, recover instead of dropping.
8. Verify on live `/artist/premium`: CalmBeast premium on, count 2/50, email + Telegram fired.
9. Do **not** tap Cleared for iOS on any new tracks as part of this job.

## Do not

- Deploy while review is open
- Trample dirty `bvsradio/` WIP (`account`, editorial, studio, layout)
- Invent a new Paynow key
- Claim DSP/white-label delivery from this seat
