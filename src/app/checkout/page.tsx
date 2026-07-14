'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useMemo, useState } from 'react'

interface CartItem {
  id: string | number
  title: string
  artist?: string
  type?: string
  price?: number
  quantity?: number
  src?: string
  delivery?: string
}

interface Customer {
  name: string
  email: string
  whatsapp: string
}

interface OrderResult {
  reference: string
  saved: boolean
  status: string
  persistenceMessage: string
  nextSteps: string[]
}

const paymentMethods = [
  {
    id: 'manual_bank',
    label: 'Bank transfer',
    detail: 'Best for larger service orders. BVS confirms bank details after order review.',
  },
  {
    id: 'mobile_money',
    label: 'Mobile money',
    detail: 'Good for Zimbabwe-facing payments. BVS confirms EcoCash/transfer details manually.',
  },
  {
    id: 'paypal',
    label: 'PayPal',
    detail: 'Good for international buyers once the BVS PayPal account is active.',
  },
  {
    id: 'card_pending',
    label: 'Card pending',
    detail: 'Stripe/card checkout will be connected after payment accounts are ready.',
  },
]

function priceFor(item: CartItem) {
  if (typeof item.price === 'number') {
    return item.price
  }

  if (item.type === 'beat') {
    return 29
  }

  if (item.type === 'mix') {
    return 4
  }

  if (item.type === 'service') {
    return 69
  }

  return 2
}

function normalizeItem(item: CartItem): CartItem {
  return {
    ...item,
    type: item.type || 'single',
    price: priceFor(item),
    quantity: item.quantity || 1,
    delivery:
      item.delivery ||
      (item.type === 'service'
        ? 'BVS will contact you for upload/stem details and project scheduling.'
        : 'Download or license link is released after payment confirmation.'),
  }
}

function serviceFromQuery() {
  if (typeof window === 'undefined') {
    return null
  }

  const params = new URLSearchParams(window.location.search)
  const item = params.get('item')

  if (!item) {
    return null
  }

  const price = Number(params.get('price') || 69)
  return normalizeItem({
    id: `service-${item.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    title: item,
    artist: 'BVS Engineering Team',
    type: 'service',
    price: Number.isFinite(price) ? price : 69,
    quantity: 1,
    delivery: 'Service order. BVS confirms payment, receives files/project brief, then delivers final masters.',
  })
}

export default function CheckoutPage() {
  const [items, setItems] = useState<CartItem[]>(() => {
    if (typeof window === 'undefined') {
      return []
    }

    const queryItem = serviceFromQuery()
    const savedCart = window.localStorage.getItem('bvs_cart')

    if (!savedCart) {
      return queryItem ? [queryItem] : []
    }

    try {
      const savedItems = JSON.parse(savedCart).map(normalizeItem)
      if (!queryItem || savedItems.some((item: CartItem) => item.id === queryItem.id)) {
        return savedItems
      }

      return [...savedItems, queryItem]
    } catch {
      return queryItem ? [queryItem] : []
    }
  })

  const [customer, setCustomer] = useState<Customer>({ name: '', email: '', whatsapp: '' })
  const [projectNotes, setProjectNotes] = useState('')
  const [paymentMethod, setPaymentMethod] = useState(paymentMethods[0].id)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<OrderResult | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    window.localStorage.setItem('bvs_cart', JSON.stringify(items))
  }, [items])

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + priceFor(item) * (item.quantity || 1), 0),
    [items],
  )

  const total = subtotal

  const removeItem = (id: string | number) => {
    setItems(items.filter((item) => item.id !== id))
  }

  const updateCustomer = (field: keyof Customer, value: string) => {
    setCustomer({ ...customer, [field]: value })
  }

  const submitOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setResult(null)

    if (items.length === 0) {
      setError('Add at least one item before checkout.')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer,
          items: items.map((item) => ({
            id: item.id,
            title: item.title,
            artist: item.artist,
            type: item.type || 'single',
            price: priceFor(item),
            quantity: item.quantity || 1,
            delivery: item.delivery,
            sourceUrl: item.src,
          })),
          paymentMethod,
          projectNotes,
          subtotal,
          total,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Checkout failed.')
      }

      setResult(data)
      window.localStorage.setItem('bvs_last_order', JSON.stringify(data))
      window.localStorage.removeItem('bvs_cart')
      setItems([])
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Checkout failed.'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <section className="mb-10 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
        <div>
          <p className="mb-3 text-xs uppercase tracking-[3px] text-brand">BVS Checkout</p>
          <h1 className="mb-4 text-5xl font-semibold">Review, pay, and get delivery steps.</h1>
          <p className="max-w-2xl text-lg text-text-secondary">
            This first checkout version supports real order intake and manual payment confirmation. Automated card/mobile-money capture comes next when the payment accounts are active.
          </p>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center text-xs text-text-secondary">
          {['Cart', 'Details', 'Payment', 'Delivery'].map((step, index) => (
            <div key={step} className="rounded-xl border border-white/10 bg-bg-card/40 px-3 py-4">
              <div className="mb-1 text-xl font-semibold text-brand">{index + 1}</div>
              <div>{step}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr]">
        <form onSubmit={submitOrder} className="space-y-8">
          <section className="rounded-2xl border border-white/10 bg-bg-card/35 p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold">1. Cart review</h2>
                <p className="text-sm text-text-secondary">Confirm items, prices, and delivery type before order creation.</p>
              </div>
              <Link href="/catalogue" className="rounded-full border border-white/20 px-4 py-2 text-sm hover:bg-white/5">
                Add music
              </Link>
            </div>

            {items.length > 0 ? (
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="grid gap-3 rounded-xl border border-white/10 bg-black/20 p-4 sm:grid-cols-[1fr_auto]">
                    <div>
                      <div className="font-semibold">{item.title}</div>
                      <div className="text-sm text-text-secondary">
                        {item.artist || 'BVS Radio'} · {item.type || 'single'} · Qty {item.quantity || 1}
                      </div>
                      <div className="mt-2 text-xs text-text-secondary">{item.delivery}</div>
                    </div>
                    <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                      <div className="text-lg font-semibold text-brand">${priceFor(item).toFixed(2)}</div>
                      <button type="button" onClick={() => removeItem(item.id)} className="text-xs text-red-300 hover:text-red-200">
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-white/15 px-5 py-8 text-center text-text-secondary">
                Your cart is empty. Add a beat, BVS track, or service to start checkout.
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-white/10 bg-bg-card/35 p-6">
            <h2 className="mb-2 text-2xl font-semibold">2. Customer details</h2>
            <p className="mb-5 text-sm text-text-secondary">Used for receipts, payment confirmation, and delivery updates.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1.5 block">Name</span>
                <input
                  required
                  value={customer.name}
                  onChange={(event) => updateCustomer('name', event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-bg-primary px-4 py-3 outline-none focus:border-brand"
                  placeholder="Your name"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block">Email</span>
                <input
                  required
                  type="email"
                  value={customer.email}
                  onChange={(event) => updateCustomer('email', event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-bg-primary px-4 py-3 outline-none focus:border-brand"
                  placeholder="you@email.com"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1.5 block">WhatsApp / phone</span>
                <input
                  value={customer.whatsapp}
                  onChange={(event) => updateCustomer('whatsapp', event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-bg-primary px-4 py-3 outline-none focus:border-brand"
                  placeholder="+263..."
                />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-bg-card/35 p-6">
            <h2 className="mb-2 text-2xl font-semibold">3. Payment method</h2>
            <p className="mb-5 text-sm text-text-secondary">Choose how you want BVS to confirm payment for this order.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {paymentMethods.map((method) => (
                <label
                  key={method.id}
                  className={`cursor-pointer rounded-xl border p-4 ${
                    paymentMethod === method.id ? 'border-brand bg-brand/10' : 'border-white/10 bg-black/20'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={method.id}
                    checked={paymentMethod === method.id}
                    onChange={() => setPaymentMethod(method.id)}
                    className="sr-only"
                  />
                  <span className="block font-semibold">{method.label}</span>
                  <span className="mt-1 block text-xs text-text-secondary">{method.detail}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-bg-card/35 p-6">
            <h2 className="mb-2 text-2xl font-semibold">4. Notes and delivery</h2>
            <p className="mb-5 text-sm text-text-secondary">
              For services, include links, references, deadlines, or the kind of sound you want.
            </p>
            <textarea
              value={projectNotes}
              onChange={(event) => setProjectNotes(event.target.value)}
              rows={5}
              className="w-full resize-y rounded-xl border border-white/10 bg-bg-primary px-4 py-3 outline-none focus:border-brand"
              placeholder="Project brief, delivery notes, license questions, or payment notes..."
            />
          </section>

          {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

          <button
            type="submit"
            disabled={isSubmitting || items.length === 0}
            className="w-full rounded-full bg-brand px-8 py-4 text-lg font-semibold text-black hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Creating order...' : 'Create Order'}
          </button>
        </form>

        <aside className="space-y-6">
          <section className="sticky top-24 rounded-2xl border border-white/10 bg-bg-card/45 p-6">
            <h2 className="mb-5 text-2xl font-semibold">Order summary</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-text-secondary">Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Processing</span>
                <span>Manual</span>
              </div>
              <div className="border-t border-white/10 pt-3">
                <div className="flex justify-between text-xl font-semibold">
                  <span>Total</span>
                  <span className="text-brand">${total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-xl bg-black/25 p-4 text-xs text-text-secondary">
              Payment is not captured automatically yet. The order is created first, then BVS confirms payment details and delivery.
            </div>
          </section>

          {result && (
            <section className="rounded-2xl border border-brand/30 bg-brand/10 p-6">
              <p className="text-xs uppercase tracking-[3px] text-brand">Order Created</p>
              <h2 className="mt-2 text-3xl font-semibold">{result.reference}</h2>
              <p className="mt-3 text-sm text-text-secondary">{result.persistenceMessage}</p>
              <div className="mt-5 space-y-2 text-sm">
                {result.nextSteps.map((step) => (
                  <div key={step} className="rounded-lg bg-black/20 px-3 py-2">
                    {step}
                  </div>
                ))}
              </div>
              <Link href="/contact" className="mt-5 inline-flex rounded-full bg-brand px-5 py-2 text-sm font-semibold text-black hover:bg-brand-dark">
                Contact BVS
              </Link>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}
