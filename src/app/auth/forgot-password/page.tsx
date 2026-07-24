'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { isSupabaseConfigured } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!isSupabaseConfigured()) {
      setError('Account service is not configured.')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'Could not send reset email')
      }
      setSent(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not send reset email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <Image
              src="/branding/bvs-logo.png"
              alt="BVS Radio"
              width={1032}
              height={552}
              className="h-14 w-auto rounded-md object-contain"
              priority
            />
          </Link>
          <h1 className="text-3xl font-bold">Reset password</h1>
          <p className="text-text-secondary mt-1">We will email you a link to choose a new password.</p>
        </div>

        {sent ? (
          <div className="rounded-2xl border border-brand/30 bg-brand/10 p-6 text-center" role="status">
            <h2 className="text-xl font-semibold">Check your email</h2>
            <p className="mt-3 text-sm text-text-secondary">
              If an account exists for <strong className="text-text-primary">{email}</strong>, a reset
              link was sent from <strong className="text-text-primary">BVS Radio (contact@bvsradio.com)</strong>.
              Check Spam too. The link opens on <strong>bvsradio.com</strong>.
            </p>
            <Link href="/auth/login" className="mt-6 inline-block text-brand hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              required
              autoComplete="email"
              className="w-full bg-bg-card border border-white/10 focus:border-brand px-4 py-3 rounded-xl outline-none"
            />
            {error && (
              <p className="text-sm text-red-400" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-brand hover:bg-brand-dark disabled:opacity-70 text-black font-semibold rounded-full"
            >
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        <p className="text-center mt-6 text-sm text-text-secondary">
          <Link href="/auth/login" className="text-brand hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
