import assert from 'node:assert/strict'
import {
  MARKETPLACE_BASKET_TARGET_USD,
  MARKETPLACE_POLICY_VERSION,
  calculateMarketplaceEconomics,
  marketplaceCommissionBps,
  processorFeeFromPreset,
  producerUpgradeBreakEvenUsd,
} from '../src/lib/marketplace-economics.ts'

function close(actual, expected, tolerance = 0.01) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} ≈ ${expected}`)
}

assert.equal(MARKETPLACE_POLICY_VERSION, '2026-08-08-v1')
assert.equal(MARKETPLACE_BASKET_TARGET_USD, 5)

const feeCases = [
  ['single', 2, 'artist_free', 2000],
  ['mix', 4, 'artist_free', 2000],
  ['single', 2, 'artist_standard', 1500],
  ['mix', 4, 'artist_founding', 1500],
  ['album', 14, 'artist_free', 1500],
  ['album', 19, 'artist_standard', 1500],
  ['beat', 29, 'producer_free', 1500],
  ['beat', 29, 'producer_plus', 800],
  ['beat', 29, 'producer_pro', 300],
  ['beat', 29, 'creator_complete', 300],
  ['service', 69, 'service_free', 1500],
  ['service', 69, 'service_pro', 800],
  ['service', 69, 'studio', 500],
  ['physical', 25, 'future', null],
]

for (const [productType, unitAmount, sellerPlanId, expected] of feeCases) {
  assert.equal(
    marketplaceCommissionBps({ productType, unitAmount, sellerPlanId }),
    expected,
    `${sellerPlanId} ${productType}`,
  )
}

// Creator Complete is mixed economics: 3% beats, 15% artist music.
assert.equal(marketplaceCommissionBps({ productType: 'mix', unitAmount: 4, sellerPlanId: 'creator_complete' }), 1500)
assert.equal(marketplaceCommissionBps({ productType: 'beat', unitAmount: 29, sellerPlanId: 'creator_complete' }), 300)

// Tax never increases BVS commission: $29 at 15% stays $4.35 even with 19% VAT.
const beatWithVat = calculateMarketplaceEconomics({
  productPrice: 29,
  taxRatePercent: 19,
  commissionBps: 1500,
  processorFee: 1.5,
  processorAllocatedToSeller: 1.5,
})
close(beatWithVat.tax, 5.51)
close(beatWithVat.commission, 4.35)
close(beatWithVat.sellerNet, 23.15)
close(beatWithVat.bvsContributionAfterProcessing, 4.35)

// BVS absorbing the same processing can turn a 3% Pro beat negative.
const proAbsorbs = calculateMarketplaceEconomics({
  productPrice: 29,
  commissionBps: 300,
  processorFee: 1.5,
  processorAllocatedToSeller: 0,
})
close(proAbsorbs.commission, 0.87)
close(proAbsorbs.sellerNet, 28.13)
close(proAbsorbs.bvsContributionAfterProcessing, -0.63)

// Low-ticket transaction economics.
const fourDollar = calculateMarketplaceEconomics({
  productPrice: 4,
  commissionBps: 2000,
  processorFee: 0.45,
  processorAllocatedToSeller: 0.45,
})
close(fourDollar.commission, 0.8)
close(fourDollar.sellerNet, 2.75)
close(fourDollar.bvsContributionAfterProcessing, 0.8)

// Producer paid tiers pay for themselves at the approved break-even GMV.
close(producerUpgradeBreakEvenUsd(5, 7), 71.43)
close(producerUpgradeBreakEvenUsd(10, 5), 200)

// Paynow schedules are explicit calculator presets, not silently booked fees.
close(processorFeeFromPreset(4, 'paynow_ecocash'), 0.1)
close(processorFeeFromPreset(4, 'paynow_visa'), 0.64)
close(processorFeeFromPreset(4, 'paynow_vpayments'), 0.54)

console.log('Marketplace economics policy tests passed.')
