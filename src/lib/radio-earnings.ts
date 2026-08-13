export const RADIO_EARNINGS_POLICY = {
  currency: 'USD',
  maximumUsdPerEligiblePlay: 0.00025,
  payoutMinimumUsd: 25,
  settlementCadence: 'monthly',
} as const

export function calculateFundedRadioCredit({
  artistEligiblePlays,
  totalEligiblePlays,
  netListenAdPotUsd,
}: {
  artistEligiblePlays: number
  totalEligiblePlays: number
  netListenAdPotUsd: number
}) {
  if (artistEligiblePlays <= 0 || totalEligiblePlays <= 0 || netListenAdPotUsd <= 0) return 0
  const potShare = netListenAdPotUsd * (artistEligiblePlays / totalEligiblePlays)
  const playCap = artistEligiblePlays * RADIO_EARNINGS_POLICY.maximumUsdPerEligiblePlay
  return Math.max(0, Math.min(potShare, playCap))
}
