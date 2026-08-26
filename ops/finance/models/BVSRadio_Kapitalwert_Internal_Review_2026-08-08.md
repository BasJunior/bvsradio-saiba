# BVS Radio Kapitalwert model — internal review

Date: 2026-08-08  
Status: Internal working document; not suitable for investor or lender circulation without validation.

## Preserved source

- Workbook: `BVSRadio_Kapitalwert_Profitability_Model_2026-08-08.xlsx`
- SHA-256: `b88c93d3830a41a8fb66434438b1d08c63d89d2d0cda7ea47d03598f61334c42`
- The source workbook was filed unchanged.

## Base-case outputs in the workbook

- Year-1 product contribution: $36,340.50
- Year-1 free cash flow: $33,940.50
- Five-year NPV: $191,551.12
- Modelled monthly units / paid subscriptions: 199
- Highest annual contribution: Artist Founding Premium — Annual ($10,393.20)
- Beat-licence blended BVS contribution: $3.0485 per $29 checkout (10.51% checkout margin)

## Internal assessment

The workbook is a useful decision framework, especially its separation of marketplace commission, processor channel, artist share, and direct BVS revenue. It correctly shows that low-ticket marketplace products suffer most from fixed processor fees and that direct subscriptions are structurally more attractive.

The $191,551 NPV is an optimistic planning case, not yet a forecast. It depends on 199 monthly units/subscriptions from Year 1, 25% annual sales growth, only $2,400 annual fixed OPEX, and only $3,000 initial investment. Those inputs are not yet supported by actual BVS cohorts, churn, conversion, or full operating costs.

## Material issues to correct

1. The `NPV` product-contribution formulas use `Assumptions!B21` (8% fixed-OPEX growth) instead of `Assumptions!B20` (25% unit-sales growth). Product PV therefore totals about $151,052.73 while the operating projection uses the intended 25% sales growth. The product PV at 25% growth is about $204,526.94 before initial investment and fixed OPEX.
2. The per-channel contribution formulas use `MAX(0, ...)`, which hides negative unit economics. Losses should remain visible for pricing and channel decisions.
3. The annual-plan volume cells are multiplied by 12. This is valid only if `10` and `6` mean new annual subscriptions sold every month. If they mean active annual subscribers, revenue is overstated twelvefold.
4. Founding pricing should not be projected as an indefinitely scalable product. It is limited to the founding window/seat policy and should roll into standard pricing or renew only under the actual founding terms.
5. The 15% artist withholding is explicitly a placeholder. It should not be used for wallet deductions until Zimbabwean tax counsel confirms the tax, liable party, base, residency treatment, and remittance process.
6. Stripe defaults use US pricing, while the actual BVS transaction showed Germany/EEA pricing plus currency conversion. The model should use actual monthly Stripe balance-transaction data.

## Missing internal cost/risk lines

- refunds, chargebacks, disputes and fraud losses
- VAT/tax administration and accounting
- artist support, editorial review and content moderation labour
- distribution partner/store costs
- storage, bandwidth and media-processing costs
- marketing/customer-acquisition cost
- email, monitoring, legal, licensing and compliance costs
- payout/FX costs and unclaimed wallet liabilities
- subscription churn, failed renewals and founding-plan dilution

## Sensitivity check

- Workbook base: NPV $191,551.12
- Same volume with zero sales growth: NPV $118,023.54
- 50% of modelled volume, 10% growth, $12,000 annual OPEX: NPV $25,392.28
- 25% of modelled volume, 10% growth, $12,000 annual OPEX: NPV -$13,743.43
- 50% of modelled volume, 10% growth, $24,000 annual OPEX: NPV -$24,486.86

The economic opportunity is credible, but profitability is highly sensitive to real sales volume and fully loaded OPEX.

## Recommended internal use

1. Treat the current workbook as Version 0 / optimistic case.
2. Add Base, Conservative and Stress scenarios driven by actual monthly orders, subscribers, churn and payment mix.
3. Import actual Stripe and Paynow fees monthly instead of relying on public headline rates.
4. Keep marketplace wallet policy as: artist payout = pre-tax price - BVS commission - processor allocation - refunds/chargebacks, subject to legally verified withholding.
5. Use direct subscriptions and services as the primary gross-profit engine; use beat/music marketplace sales for catalogue growth and acquisition unless basket size or processor allocation improves.
6. Do not make hiring, borrowing or investor-valuation decisions from the $191,551 NPV until at least three months of cohort and cost data are reconciled.
