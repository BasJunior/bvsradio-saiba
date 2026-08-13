import 'server-only'

import { getStripe } from '@/lib/stripe'

export type ResolvedProcessorFee = {
  amountOrderCurrency: number
  status: 'actual'
  nativeAmount: number
  nativeCurrency: string
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

/**
 * Stripe balance transactions store the actual processor fee in the account's
 * settlement currency. When Stripe exposes exchange_rate, convert that fee
 * back to the order currency for seller settlement allocation.
 */
export async function resolveStripeProcessorFee(
  paymentIntentId: string | null | undefined,
  orderCurrency = 'usd',
): Promise<ResolvedProcessorFee | null> {
  const stripe = getStripe()
  if (!stripe || !paymentIntentId) return null

  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ['latest_charge.balance_transaction'],
    })
    const charge = intent.latest_charge
    if (!charge || typeof charge === 'string') return null

    let balanceTransaction = charge.balance_transaction
    if (!balanceTransaction) return null
    if (typeof balanceTransaction === 'string') {
      balanceTransaction = await stripe.balanceTransactions.retrieve(balanceTransaction)
    }

    const nativeAmount = Number(balanceTransaction.fee || 0) / 100
    const nativeCurrency = String(balanceTransaction.currency || '').toLowerCase()
    if (!Number.isFinite(nativeAmount) || nativeAmount < 0 || !nativeCurrency) return null

    const targetCurrency = String(orderCurrency || 'usd').toLowerCase()
    let amountOrderCurrency = nativeAmount
    if (nativeCurrency !== targetCurrency) {
      const rate = Number(balanceTransaction.exchange_rate || 0)
      if (!Number.isFinite(rate) || rate <= 0) return null
      amountOrderCurrency = nativeAmount / rate
    }

    return {
      amountOrderCurrency: roundMoney(amountOrderCurrency),
      status: 'actual',
      nativeAmount: roundMoney(nativeAmount),
      nativeCurrency: nativeCurrency.toUpperCase(),
    }
  } catch (error) {
    console.warn('Stripe processor fee unavailable:', error instanceof Error ? error.message : error)
    return null
  }
}
