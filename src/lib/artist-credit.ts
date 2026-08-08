import 'server-only'

import {
  MARKETPLACE_POLICY_VERSION,
  marketplaceCommissionBps,
  type MarketplaceProductType,
} from '@/lib/marketplace-economics'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const headers = { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' }

type OrderRow = { id: string; reference: string; customer_user_id?: string; items?: Array<{ type?: string; price?: number; quantity?: number }> }

type ProcessorFeeInput = {
  amountOrderCurrency: number
  status: 'actual' | 'schedule' | 'estimated'
  nativeAmount?: number | null
  nativeCurrency?: string | null
}

type CommerceItemRow = {
  seller_user_id_snapshot?: string | null
  product_type_snapshot: MarketplaceProductType
  unit_amount: number | string
  quantity: number
  currency: string
  sku_snapshot?: string | null
  title_snapshot?: string | null
}

type MembershipRow = {
  plan_id?: string | null
  family?: string | null
  entitlements?: Record<string, unknown> | null
  starts_at?: string | null
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

async function sellerPlanForProduct(userId: string, productType: MarketplaceProductType) {
  const response = await fetch(
    `${url}/rest/v1/bvs_memberships?user_id=eq.${encodeURIComponent(userId)}&status=in.(active,trialing,shell)&select=plan_id,family,entitlements,starts_at&order=starts_at.desc&limit=10`,
    { headers, cache: 'no-store' },
  )
  const rows = response.ok ? await response.json() as MembershipRow[] : []
  const bundle = rows.find((row) => row.family === 'creator_bundle')
  if (bundle?.plan_id) return { planId: String(bundle.plan_id), entitlements: bundle.entitlements || {} }

  const wantedFamily = productType === 'beat' ? 'producer' : productType === 'service' ? 'service' : 'artist'
  const row = rows.find((item) => item.family === wantedFamily)
  if (row?.plan_id) return { planId: String(row.plan_id), entitlements: row.entitlements || {} }

  return {
    planId: productType === 'beat' ? 'producer_free' : productType === 'service' ? 'service_free' : 'artist_free',
    entitlements: {},
  }
}

async function commissionForItem(userId: string, item: CommerceItemRow) {
  const seller = await sellerPlanForProduct(userId, item.product_type_snapshot)
  const entitlementBps = Number(seller.entitlements.marketplace_commission_bps)
  const policyBps = marketplaceCommissionBps({
    productType: item.product_type_snapshot,
    unitAmount: Number(item.unit_amount) || 0,
    sellerPlanId: seller.planId,
  })
  const bps = Number.isFinite(entitlementBps) && entitlementBps >= 0
    ? Math.floor(entitlementBps)
    : policyBps
  return { planId: seller.planId, bps: bps == null ? 0 : bps }
}

export async function creditPaidArtistDeposit(reference: string, source: 'stripe' | 'paynow') {
  if (!url || !service || !reference) return { credited: false, reason: 'not_configured' }
  const orderResponse = await fetch(`${url}/rest/v1/orders?reference=eq.${encodeURIComponent(reference)}&select=id,reference,customer_user_id,items&limit=1`, { headers, cache: 'no-store' })
  if (!orderResponse.ok) return { credited: false, reason: 'order_lookup_failed' }
  const [order] = await orderResponse.json() as OrderRow[]
  if (!order?.customer_user_id) return { credited: false, reason: 'anonymous_order' }
  const amount = (order.items || []).filter(item => item.type === 'artist_deposit').reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0)
  if (amount <= 0) return { credited: false, reason: 'not_artist_deposit' }

  const externalReference = `${source}:${reference}`
  const depositResponse = await fetch(`${url}/rest/v1/artist_deposits?on_conflict=source,external_reference`, {
    method: 'POST', headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ artist_user_id: order.customer_user_id, amount, currency: 'USD', status: 'credited', source,
      external_reference: externalReference, order_id: order.id, received_at: new Date().toISOString(),
      creditable_at: new Date().toISOString(), credited_at: new Date().toISOString() }),
  })
  if (!depositResponse.ok) return { credited: false, reason: 'deposit_save_failed' }
  const [deposit] = await depositResponse.json() as Array<{ id: string }>
  if (!deposit?.id) return { credited: false, reason: 'deposit_missing' }

  const existingResponse = await fetch(`${url}/rest/v1/artist_ledger_entries?deposit_id=eq.${deposit.id}&entry_type=eq.deposit_credit&select=id&limit=1`, { headers, cache: 'no-store' })
  if (existingResponse.ok && (await existingResponse.json()).length) return { credited: true, idempotent: true }
  const ledgerResponse = await fetch(`${url}/rest/v1/artist_ledger_entries`, {
    method: 'POST', headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({ artist_user_id: order.customer_user_id, direction: 'credit', entry_type: 'deposit_credit',
      amount, currency: 'USD', status: 'posted', source_table: 'orders', source_id: order.id,
      deposit_id: deposit.id, memo: `Creditable BVS artist deposit ${reference}`, metadata: { reference, source } }),
  })
  if (!ledgerResponse.ok) return { credited: false, reason: 'ledger_save_failed' }
  return { credited: true, idempotent: false }
}

/**
 * Marketplace settlement policy:
 * pre-tax product revenue - BVS commission - allocated processor cost = seller net.
 * If processor cost is not yet known, the seller credit stays pending and is not payout-available.
 */
export async function creditPaidArtistSales(
  reference: string,
  source: 'stripe' | 'paynow',
  processorFee?: ProcessorFeeInput | null,
) {
  if (!url || !service || !reference) return { credited: false, reason: 'not_configured' }
  const orderResponse = await fetch(`${url}/rest/v1/orders?reference=eq.${encodeURIComponent(reference)}&status=in.(paid,fulfilled)&select=id,reference&limit=1`, { headers, cache: 'no-store' })
  if (!orderResponse.ok) return { credited: false, reason: 'order_lookup_failed' }
  const [order] = await orderResponse.json() as Array<{ id: string; reference: string }>
  if (!order?.id) return { credited: false, reason: 'order_not_paid' }

  const itemResponse = await fetch(
    `${url}/rest/v1/commerce_order_items?order_id=eq.${order.id}&select=seller_user_id_snapshot,product_type_snapshot,unit_amount,quantity,currency,sku_snapshot,title_snapshot&order=line_number.asc`,
    { headers, cache: 'no-store' },
  )
  if (!itemResponse.ok) return { credited: false, reason: 'items_lookup_failed' }
  const items = await itemResponse.json() as CommerceItemRow[]
  const totalProductRevenue = items.reduce((sum, item) => sum + (Number(item.unit_amount) || 0) * (Number(item.quantity) || 0), 0)
  const sellerItems = items.filter((item) => Boolean(item.seller_user_id_snapshot))
  if (!sellerItems.length) return { credited: false, reason: 'no_attributed_seller' }

  const bySeller = new Map<string, CommerceItemRow[]>()
  for (const item of sellerItems) {
    const sellerId = String(item.seller_user_id_snapshot)
    bySeller.set(sellerId, [...(bySeller.get(sellerId) || []), item])
  }

  let credited = 0
  let pending = 0
  for (const [sellerId, rows] of bySeller) {
    let gross = 0
    let platformFee = 0
    let sellerPlanId = ''
    const lineBreakdown: Array<Record<string, unknown>> = []

    for (const item of rows) {
      const lineGross = roundMoney((Number(item.unit_amount) || 0) * (Number(item.quantity) || 0))
      if (lineGross <= 0) continue
      const commission = await commissionForItem(sellerId, item)
      sellerPlanId = sellerPlanId || commission.planId
      const lineFee = roundMoney(lineGross * commission.bps / 10000)
      gross = roundMoney(gross + lineGross)
      platformFee = roundMoney(platformFee + lineFee)
      lineBreakdown.push({
        sku: item.sku_snapshot,
        title: item.title_snapshot,
        productType: item.product_type_snapshot,
        gross: lineGross,
        planId: commission.planId,
        commissionBps: commission.bps,
        platformFee: lineFee,
      })
    }

    if (gross <= 0) continue
    const processorAllocated = processorFee && totalProductRevenue > 0
      ? roundMoney(processorFee.amountOrderCurrency * (gross / totalProductRevenue))
      : 0
    const sellerNet = roundMoney(Math.max(0, gross - platformFee - processorAllocated))
    const effectiveBps = gross > 0 ? Math.round(platformFee / gross * 10000) : 0
    const settlementStatus = processorFee ? 'posted' : 'pending_processor'
    const processorStatus = processorFee?.status || 'not_connected'

    const settlementResponse = await fetch(`${url}/rest/v1/commerce_seller_settlements?on_conflict=order_id,seller_user_id`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({
        order_id: order.id,
        order_reference: reference,
        seller_user_id: sellerId,
        provider: source,
        policy_version: MARKETPLACE_POLICY_VERSION,
        seller_plan_id: sellerPlanId || null,
        gross_product_revenue: gross,
        platform_fee_bps: effectiveBps,
        platform_fee_amount: platformFee,
        processor_fee_allocated: processorAllocated,
        processor_fee_status: processorStatus,
        processor_fee_native_amount: processorFee?.nativeAmount ?? null,
        processor_fee_native_currency: processorFee?.nativeCurrency ?? null,
        seller_net: sellerNet,
        settlement_status: settlementStatus,
        breakdown: { lines: lineBreakdown, processorAllocationBasis: 'share_of_pre_tax_order_product_revenue' },
        updated_at: new Date().toISOString(),
      }),
    })
    if (!settlementResponse.ok) return { credited: false, reason: 'settlement_save_failed' }

    const existingResponse = await fetch(
      `${url}/rest/v1/artist_ledger_entries?artist_user_id=eq.${sellerId}&source_table=eq.orders&source_id=eq.${order.id}&entry_type=eq.sale_credit&select=id,amount,status,metadata&limit=1`,
      { headers, cache: 'no-store' },
    )
    const existing = existingResponse.ok
      ? (await existingResponse.json() as Array<{ id: string; amount: number | string; status: string; metadata?: Record<string, unknown> }>)[0]
      : undefined

    if (existing?.status === 'posted' && existing.metadata?.policyVersion !== MARKETPLACE_POLICY_VERSION) {
      // Preserve historical ledger. Finance flags legacy gross credits for explicit Founder-authorized adjustment.
      continue
    }

    const ledgerPayload = {
      artist_user_id: sellerId,
      direction: 'credit',
      entry_type: 'sale_credit',
      amount: sellerNet,
      currency: String(rows[0]?.currency || 'usd').toUpperCase(),
      status: settlementStatus === 'posted' ? 'posted' : 'pending',
      source_table: 'orders',
      source_id: order.id,
      memo: `Marketplace sale ${reference}`,
      metadata: {
        reference,
        source,
        policyVersion: MARKETPLACE_POLICY_VERSION,
        grossProductRevenue: gross,
        platformFee,
        processorFeeAllocated: processorAllocated,
        processorFeeStatus: processorStatus,
        sellerNet,
        sellerPlanId,
      },
    }

    if (existing?.id) {
      const update = await fetch(`${url}/rest/v1/artist_ledger_entries?id=eq.${existing.id}`, {
        method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify(ledgerPayload),
      })
      if (!update.ok) return { credited: false, reason: 'ledger_update_failed' }
    } else {
      const response = await fetch(`${url}/rest/v1/artist_ledger_entries`, {
        method: 'POST', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify(ledgerPayload),
      })
      if (!response.ok && response.status !== 409) return { credited: false, reason: 'ledger_save_failed' }
    }

    if (settlementStatus === 'posted') credited += 1
    else pending += 1
  }

  return {
    credited: credited > 0,
    entries: credited,
    pending,
    processorFeeStatus: processorFee?.status || 'not_connected',
  }
}
