import { NextResponse } from 'next/server'
import { editorialIdentity, editorialUrl, serviceHeaders } from '@/lib/editorial-server'

type Row = Record<string, unknown>

async function requiredRows(path: string): Promise<Row[]> {
  const response = await fetch(editorialUrl(path), { headers: serviceHeaders, cache: 'no-store' })
  if (!response.ok) throw new Error(`finance source ${response.status}`)
  const payload = await response.json()
  return Array.isArray(payload) ? payload : []
}

async function optionalRows(path: string): Promise<{ rows: Row[]; available: boolean }> {
  try {
    const response = await fetch(editorialUrl(path), { headers: serviceHeaders, cache: 'no-store' })
    if (!response.ok) return { rows: [], available: false }
    const payload = await response.json()
    return { rows: Array.isArray(payload) ? payload : [], available: true }
  } catch {
    return { rows: [], available: false }
  }
}

function money(value: unknown) {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : 0
}

function itemValue(item: unknown) {
  if (!item || typeof item !== 'object') return 0
  const row = item as Record<string, unknown>
  return money(row.price ?? row.unitAmount ?? row.unit_amount) * Math.max(1, money(row.quantity) || 1)
}

function isMarketplaceItem(item: unknown) {
  if (!item || typeof item !== 'object') return false
  const row = item as Record<string, unknown>
  return ['single', 'mix', 'album', 'beat'].includes(String(row.productType || row.product_type || row.type || '').toLowerCase())
}

function isoStartOfMonth(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
}

function isoStartOfQuarter(now: Date) {
  const month = Math.floor(now.getUTCMonth() / 3) * 3
  return new Date(Date.UTC(now.getUTCFullYear(), month, 1)).toISOString()
}

function membershipMrr(row: Row) {
  const plan = String(row.plan_id || '').toLowerCase()
  const interval = String(row.billing_interval || '').toLowerCase()
  const annual = interval === 'year'
  if (plan.includes('founding')) return annual ? 90 / 12 : 9
  if (plan.includes('standard') || plan.includes('artist')) return annual ? 120 / 12 : 12
  return 0
}

export async function GET(request: Request) {
  const identity = await editorialIdentity(request)
  if (!identity) {
    return NextResponse.json({ error: 'Active Editorial staff access is required.' }, { status: 403 })
  }

  const now = new Date()
  const monthStart = isoStartOfMonth(now)
  const quarterStart = isoStartOfQuarter(now)

  try {
    const [orders, memberships, quarterLedger, allLedger, paymentEvents, newsletter] = await Promise.all([
      requiredRows(`orders?status=in.(paid,fulfilled)&created_at=gte.${encodeURIComponent(quarterStart)}&select=id,reference,subtotal,total,tax_amount,currency,status,payment_method,items,created_at,paid_at&order=created_at.asc&limit=5000`),
      optionalRows('bvs_memberships?family=eq.artist&status=in.(active,trialing)&select=id,user_id,plan_id,billing_interval,status,provider,starts_at,ends_at&limit=5000'),
      optionalRows(`artist_ledger_entries?status=eq.posted&effective_at=gte.${encodeURIComponent(quarterStart)}&select=direction,entry_type,amount,currency,effective_at&limit=10000`),
      optionalRows('artist_ledger_entries?status=eq.posted&select=direction,entry_type,amount,currency&limit=20000'),
      optionalRows(`commerce_payment_events?received_at=gte.${encodeURIComponent(quarterStart)}&select=verified,reconciled,reconciliation_error,provider,amount,currency,received_at&limit=5000`),
      optionalRows('newsletter_subscribers?is_active=eq.true&select=id,subscribed_at&limit=10000'),
    ])

    const monthOrders = orders.filter((order) => String(order.created_at || order.paid_at || '') >= monthStart)
    const marketplaceValue = (source: Row[]) => source.reduce((sum, order) => {
      const items = Array.isArray(order.items) ? order.items : []
      return sum + items.filter(isMarketplaceItem).reduce((lineSum, item) => lineSum + itemValue(item), 0)
    }, 0)
    const marketplaceOrders = (source: Row[]) => source.filter((order) => {
      const items = Array.isArray(order.items) ? order.items : []
      return items.some(isMarketplaceItem)
    })

    const quarterGmv = orders.reduce((sum, order) => sum + money(order.subtotal), 0)
    const quarterCheckout = orders.reduce((sum, order) => sum + money(order.total), 0)
    const quarterTax = orders.reduce((sum, order) => sum + money(order.tax_amount), 0)
    const quarterArtistCredits = quarterLedger.rows
      .filter((row) => row.direction === 'credit' && row.entry_type === 'sale_credit')
      .reduce((sum, row) => sum + money(row.amount), 0)
    const walletLiability = allLedger.rows.reduce((sum, row) => (
      sum + (row.direction === 'credit' ? money(row.amount) : -money(row.amount))
    ), 0)
    const reconciledEvents = paymentEvents.rows.filter((row) => row.verified === true && row.reconciled === true).length

    return NextResponse.json({
      generatedAt: now.toISOString(),
      period: { monthStart, quarterStart, quarter: `Q${Math.floor(now.getUTCMonth() / 3) + 1} ${now.getUTCFullYear()}` },
      current: {
        paidArtists: memberships.available ? memberships.rows.filter((row) => Boolean(row.provider)).length : null,
        activeArtistMemberships: memberships.available ? memberships.rows.length : null,
        subscriptionMrr: memberships.available
          ? memberships.rows.filter((row) => Boolean(row.provider)).reduce((sum, row) => sum + membershipMrr(row), 0)
          : null,
        newsletterSubscribers: newsletter.available ? newsletter.rows.length : null,
        monthMarketplaceGmv: marketplaceValue(monthOrders),
        monthMarketplaceOrders: marketplaceOrders(monthOrders).length,
        quarterMarketplaceGmv: marketplaceValue(orders),
        quarterMarketplaceOrders: marketplaceOrders(orders).length,
      },
      accounting: {
        quarterGmv,
        quarterCheckout,
        quarterTax,
        quarterArtistSaleCredits: quarterLedger.available ? quarterArtistCredits : null,
        contributionBeforeProcessor: quarterLedger.available ? quarterGmv - quarterArtistCredits : null,
        walletLiability: allLedger.available ? walletLiability : null,
        processorFees: null,
        grossProfit: null,
      },
      controls: {
        paidOrders: orders.length,
        verifiedPaymentEvents: paymentEvents.available ? paymentEvents.rows.filter((row) => row.verified === true).length : null,
        reconciledPaymentEvents: paymentEvents.available ? reconciledEvents : null,
        unresolvedPaymentEvents: paymentEvents.available ? paymentEvents.rows.filter((row) => row.reconciled !== true).length : null,
      },
      availability: {
        memberships: memberships.available,
        artistLedger: quarterLedger.available && allLedger.available,
        paymentEvents: paymentEvents.available,
        newsletter: newsletter.available,
        processorFees: false,
      },
    })
  } catch (error) {
    console.error('Editorial finance dashboard failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Finance statistics are temporarily unavailable.' }, { status: 503 })
  }
}
