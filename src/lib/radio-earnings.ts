export const RADIO_EARNINGS_POLICY = {
  currency: 'USD',
  maximumUsdPerEligiblePlay: 0.00025,
  payoutMinimumUsd: 25,
  settlementCadence: 'monthly',
  /** 30s truthful listen is measurement only; wallet credit is monthly + funded pot. */
  qualifiedStreamSeconds: 30,
} as const

export type ListenAdPotSettings = {
  enabled: boolean
  /** Net USD available to artists for the current/open settlement month. */
  netListenAdPotUsd: number
  currency: string
  notes?: string
  updatedAt?: string
}

export const DEFAULT_LISTEN_AD_POT: ListenAdPotSettings = {
  enabled: false,
  netListenAdPotUsd: 0,
  currency: 'USD',
  notes: 'Activate only after real listen-ad (or deliberately funded) cash exists. Do not raid Premium, BeatStore, or studio revenue.',
}

export function parseListenAdPotSettings(value: unknown): ListenAdPotSettings {
  if (!value || typeof value !== 'object') return { ...DEFAULT_LISTEN_AD_POT }
  const row = value as Record<string, unknown>
  const pot = Number(row.netListenAdPotUsd ?? row.net_listen_ad_pot_usd ?? 0)
  return {
    enabled: row.enabled === true,
    netListenAdPotUsd: Number.isFinite(pot) && pot > 0 ? pot : 0,
    currency: String(row.currency || 'USD').toUpperCase().slice(0, 3) || 'USD',
    notes: typeof row.notes === 'string' ? row.notes : DEFAULT_LISTEN_AD_POT.notes,
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : typeof row.updated_at === 'string' ? row.updated_at : undefined,
  }
}

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

/** Theoretical max stream liability if the pot fully funds the per-play cap. */
export function theoreticalStreamLiabilityUsd(eligiblePlays: number) {
  if (eligiblePlays <= 0) return 0
  return eligiblePlays * RADIO_EARNINGS_POLICY.maximumUsdPerEligiblePlay
}

export function fundedStreamLiabilityUsd({
  eligiblePlays,
  totalEligiblePlays,
  pot,
}: {
  eligiblePlays: number
  totalEligiblePlays: number
  pot: ListenAdPotSettings
}) {
  if (!pot.enabled || pot.netListenAdPotUsd <= 0) return 0
  return calculateFundedRadioCredit({
    artistEligiblePlays: eligiblePlays,
    totalEligiblePlays,
    netListenAdPotUsd: pot.netListenAdPotUsd,
  })
}
