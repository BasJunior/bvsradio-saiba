'use client'

import { useEffect } from 'react'
import { trackEventOnce } from '@/lib/analytics'

type CartLine = {
  id?: string | number
  type?: string
  licence_option_id?: string
  price?: number
  quantity?: number
}

export default function CheckoutFunnelAnalytics() {
  useEffect(() => {
    const raw = window.localStorage.getItem('bvs_cart')
    if (!raw) return
    try {
      const lines = JSON.parse(raw) as CartLine[]
      const beats = Array.isArray(lines) ? lines.filter((line) => line?.type === 'beat') : []
      for (const beat of beats) {
        const beatId = String(beat.id || '')
        if (!beatId) continue
        trackEventOnce('licence_selected', {
          beat_id: beatId,
          has_licence_option: Boolean(beat.licence_option_id),
          unit_price: typeof beat.price === 'number' && Number.isFinite(beat.price) ? beat.price : null,
          quantity: typeof beat.quantity === 'number' && Number.isFinite(beat.quantity) ? beat.quantity : 1,
          source: 'checkout_cart',
        }, `${beatId}:${beat.licence_option_id || 'default'}`)
      }
    } catch {
      // Checkout itself remains authoritative; analytics must never block it.
    }
  }, [])
  return null
}
