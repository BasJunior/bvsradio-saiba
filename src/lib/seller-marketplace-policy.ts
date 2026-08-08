import 'server-only'

import {
  MARKETPLACE_POLICY_VERSION,
  marketplaceCommissionBps,
  type MarketplaceProductType,
} from '@/lib/marketplace-economics'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export type SellerMarketplacePolicySnapshot = {
  planId: string
  commissionBps: number
  policyVersion: string
  source: 'membership' | 'default'
}

type MembershipRow = {
  plan_id?: string | null
  family?: string | null
  entitlements?: Record<string, unknown> | null
  starts_at?: string | null
}

function defaultPlan(productType: MarketplaceProductType) {
  if (productType === 'beat' || productType === 'creator_product') return 'producer_free'
  if (productType === 'service') return 'service_free'
  return 'artist_free'
}

/**
 * Resolve a seller's commercial policy for a specific product at checkout time.
 * The result is snapshotted onto the immutable order line so later upgrades or
 * policy changes cannot rewrite the economics of an existing order.
 */
export async function resolveSellerMarketplacePolicy(
  userId: string | undefined,
  productType: MarketplaceProductType,
  unitAmount: number,
): Promise<SellerMarketplacePolicySnapshot> {
  let planId = defaultPlan(productType)
  let entitlements: Record<string, unknown> = {}
  let source: SellerMarketplacePolicySnapshot['source'] = 'default'

  if (url && service && userId) {
    try {
      const headers = { apikey: service, Authorization: `Bearer ${service}` }
      const response = await fetch(
        `${url}/rest/v1/bvs_memberships?user_id=eq.${encodeURIComponent(userId)}&status=in.(active,trialing,shell)&select=plan_id,family,entitlements,starts_at&order=starts_at.desc&limit=10`,
        { headers, cache: 'no-store' },
      )
      const rows = response.ok ? await response.json() as MembershipRow[] : []
      const bundle = rows.find((row) => row.family === 'creator_bundle')
      const wantedFamily = productType === 'beat' || productType === 'creator_product' ? 'producer' : productType === 'service' ? 'service' : 'artist'
      const selected = bundle || rows.find((row) => row.family === wantedFamily)
      if (selected?.plan_id) {
        planId = String(selected.plan_id)
        entitlements = selected.entitlements && typeof selected.entitlements === 'object' ? selected.entitlements : {}
        source = 'membership'
      }
    } catch {
      // Default fee policy is deliberately safe if membership lookup is unavailable.
    }
  }

  const policyBps = marketplaceCommissionBps({ productType, unitAmount, sellerPlanId: planId })
  const entitlementBps = Number(entitlements.marketplace_commission_bps)
  const mayOverride = productType === 'beat' || productType === 'creator_product' || productType === 'service'
  const commissionBps = mayOverride && Number.isFinite(entitlementBps) && entitlementBps >= 0
    ? Math.floor(entitlementBps)
    : policyBps ?? 0

  return {
    planId,
    commissionBps,
    policyVersion: MARKETPLACE_POLICY_VERSION,
    source,
  }
}
