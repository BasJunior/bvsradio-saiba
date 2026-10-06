# Grow with BVS

The first release adds promotion links, creator goals, star levels, achievement badges and public song landing pages. The existing share composer supplies Story and square cards, captions and native sharing. Creator Studio supports web, iOS and Android.

## Recognition levels

| Level | Published items | Promotion links | Publishing weeks | Validated listeners (artists) | Verified sales (artists/producers) |
|---|---:|---:|---:|---:|---:|
| Launch | 1 | 1 | 2 | 10 | 1 |
| Momentum | 3 | 3 | 4 | 100 | 3 |
| Breakthrough | 5 | 5 | 8 | 1,000 | 10 |

Thresholds are initial recognition rules, not cash reward policy. Goals are cumulative. Music and beat progress are calculated separately. Shows have publishing, promotion and consistency goals because verified show audience and monetization are not available. Link preparation is verifiable; posting to an external social account is not. Do not describe preparation as proof of posting.

Streams count distinct authenticated listeners with eligible/settled records and exclude the creator. Pending stream events do not count. On 6 October the production project had 850 pending stream records and no eligible ones: audience milestones require the existing validation/settlement pipeline to become operational. Do not bulk approve them to fill stars.

Sales require canonical seller attribution, verified and reconciled payment events, positive item value, a paid/fulfilled order, no refund/reversal, and a different buyer account/email. Old sales lacking immutable snapshots cannot be safely backfilled from client events. Achievement badges are historical recognition, not payout authorization; later reversals reduce current progress and must be rechecked for any paid reward.

## Promotion

Only owned, public, approved content gets a promotion link. Each creator/item has one stable link; retries do not create extra promotion stars. Redirects resolve current publication status and fixed BVS paths. Seven-day signed last-click cookies support item-specific engagement reporting. DNT, known crawlers and prefetches do not create visit records. Visits use hashed random browser identifiers; no IPs are persisted. Plays/saves are estimates from client analytics, separate from validated audience and payment data. Purchases and affiliate payouts are not attributed by this first release.

## Proposed paid campaign, to design before launch

- Completing all required stars could award US$15–30 in BVS reward credits. Amounts remain uncalculated and are not promised in the product.
- Keep withdrawable rewards in a separate double-entry ledger, distinct from artist royalties, seller earnings, purchased credit and affiliate commissions.
- Freeze eligibility, amount, funding cap and rule version at campaign launch. Grant once per member/campaign/level; audit qualification evidence and reversal decisions.
- Define whether credits are spendable, withdrawable or both; publish maturity, payout threshold and review terms before enrollment. Check eligibility again before payout.
- Incentivize verified sale and retained-audience results. Do not pay for raw client plays, clicks, badge ownership or unverified social posts.
- Affiliate benefits require seller opt-in, a funded commission basis, attribution window, refund handling and a separate pending/available/paid ledger.

## Global Stage

The final stage is an opportunity for international tour consideration, not automatic booking. Combine sustained BVS audience, authenticated distributor reports, listener geography, live performance readiness, demand and agreed tour funding. External distributor streams are not currently connected. Tour selection and contracts remain explicit editorial/business decisions.

## Next delivery slices

1. Operate and test stream validation; add creator-owned follower notifications using the existing opt-in notification system.
2. Attribute verified purchases to promotion links; add conversion reporting without altering sale splits.
3. Pilot a capped rewards campaign with five creators after policy and credit ledger are ready.
4. Add affiliates, independent accounting and owner campaign controls.
5. Connect distributor reporting before Global Stage evaluation.

## Verification

Run typecheck, creator-growth behavior tests, existing Studio/share/security gates and the full build. Apply the additive migration to the confirmed BVS project. Verify RPC aggregation, service-only grants/RLS and cross-account ownership rejection. Browser-test the full creator → link → song/beat/episode → engagement → results loop on a deployment with signed-in test accounts before paid campaigns.
