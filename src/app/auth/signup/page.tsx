'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { isSupabaseConfigured } from '@/lib/supabase'
import { SIGNUP_ROLES, type SignupRole } from '@/lib/signup-roles'

type SignupForm = {
  email: string
  password: string
  fullName: string
  username: string
  role: SignupRole | ''
}

export default function SignupPage() {
  const [form, setForm] = useState<SignupForm>({ email: '', password: '', fullName: '', username: '', role: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null)
  const [resendMessage, setResendMessage] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const resendConfirmation = async () => {
    if (!verificationEmail) return
    setResendMessage('Sending…')
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verificationEmail, resendOnly: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setResendMessage(data.error || 'Could not resend confirmation email.')
        return
      }
      setResendMessage(data.message || 'A new confirmation link was sent. Check inbox and Spam.')
    } catch {
      setResendMessage('Could not resend confirmation email.')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setInfo(null)

    if (!form.role) {
      setError('Choose what you want to do first on BVS.')
      setLoading(false)
      return
    }

    if (!isSupabaseConfigured()) {
      setError('Account service is not configured. Please try again later.')
      setLoading(false)
      return
    }

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      setLoading(false)
      return
    }

    const email = form.email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address (must include @ and a domain), e.g. you@gmail.com.')
      setLoading(false)
      return
    }

    const username = form.username.trim()
    if (!/^[a-zA-Z0-9._-]{2,32}$/.test(username)) {
      setError('Username: 2–32 characters, letters/numbers/._- only (no spaces).')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password: form.password,
          username,
          fullName: form.fullName.trim(),
          role: form.role,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'Signup failed')
      }

      if (data.needsConfirmation !== false) {
        setVerificationEmail(email)
        setInfo(null)
        return
      }

      setInfo(data.message || 'Account created.')
      window.location.href = '/auth/login'
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center justify-center mb-6" aria-label="BVS Radio home">
            <Image
              src="/branding/bvs-logo.png"
              alt="BVS Radio"
              width={1032}
              height={552}
              className="h-14 w-auto rounded-md object-contain"
              priority
            />
          </Link>
          <h1 className="text-3xl font-bold">Join the movement</h1>
          <p className="text-text-secondary mt-2">
            Create your free account and choose what you want to do first. You can add more roles later.
          </p>
        </div>

        {verificationEmail ? (
          <div className="rounded-2xl border border-brand/30 bg-brand/10 p-6 text-center" role="status">
            <h2 className="text-xl font-semibold">Check your email</h2>
            <p className="mt-3 text-sm text-text-secondary">
              We sent a confirmation link from <strong className="text-text-primary">BVS Radio (contact@bvsradio.com)</strong> to{' '}
              <strong className="text-text-primary">{verificationEmail}</strong>.
              Open it to finish creating your account.
            </p>
            <p className="mt-4 text-xs text-text-secondary">
              Also check Spam or Promotions. The link should open on <strong>bvsradio.com</strong>, not localhost.
              Open the newest email in a full browser tab (mail previews can burn the one-time link).
              If you see "otp_expired" or invalid link, use Resend below and ignore older emails.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-4 text-sm">
              <button type="button" onClick={resendConfirmation} className="text-brand hover:underline">
                Resend confirmation
              </button>
              <button
                type="button"
                onClick={() => {
                  setVerificationEmail(null)
                  setResendMessage(null)
                }}
                className="text-brand hover:underline"
              >
                Use a different email
              </button>
              <Link href="/auth/login" className="text-brand hover:underline">
                Sign in
              </Link>
            </div>
            {resendMessage && <p className="mt-3 text-xs text-text-secondary">{resendMessage}</p>}
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <fieldset>
              <legend className="text-base font-semibold">What do you want to do first?</legend>
              <p className="mt-1 text-sm text-text-secondary">
                Choose your starting workspace. Nothing is selected for you, and every account can still listen and discover.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {SIGNUP_ROLES.map((option) => {
                  const selected = form.role === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setForm({ ...form, role: option.value })
                        setError(null)
                      }}
                      className={`rounded-2xl border p-4 text-left transition ${
                        selected
                          ? 'border-brand bg-brand/10 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]'
                          : 'border-white/10 bg-bg-card hover:border-brand/50 hover:bg-white/[.03]'
                      } ${option.value === 'listener' ? 'sm:col-span-2' : ''}`}
                    >
                      <span className="flex items-start justify-between gap-4">
                        <span>
                          <span className="block font-semibold text-text-primary">{option.title}</span>
                          <span className="mt-1 block text-sm text-text-secondary">{option.copy}</span>
                        </span>
                        <span
                          aria-hidden="true"
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${
                            selected ? 'border-brand bg-brand text-black' : 'border-white/20 text-transparent'
                          }`}
                        >
                          ✓
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
              <p className="mt-3 text-xs text-text-secondary">
                Your first choice is not permanent. Add or apply for other creator roles later from Account Centre.
              </p>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <input
                type="text"
                placeholder="Full name"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                required
                autoComplete="name"
                className="w-full bg-bg-card border border-white/10 focus:border-brand px-4 py-3 rounded-xl outline-none"
              />
              <input
                type="text"
                placeholder="Username (no spaces)"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                required
                autoComplete="username"
                className="w-full bg-bg-card border border-white/10 focus:border-brand px-4 py-3 rounded-xl outline-none"
              />
            </div>
            <input
              type="email"
              placeholder="you@email.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              autoComplete="email"
              inputMode="email"
              title="Use a full email like you@gmail.com"
              className="w-full bg-bg-card border border-white/10 focus:border-brand px-4 py-3 rounded-xl outline-none"
            />
            <input
              type="password"
              placeholder="Create a password (min 8 characters)"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full bg-bg-card border border-white/10 focus:border-brand px-4 py-3 rounded-xl outline-none"
            />

            {error && (
              <p className="text-sm text-red-400" role="alert">
                {error}
              </p>
            )}
            {info && (
              <p className="text-sm text-brand" role="status">
                {info}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 mt-2 bg-brand hover:bg-brand-dark disabled:opacity-70 text-black font-semibold rounded-full transition-all"
            >
              {loading ? 'Creating account…' : 'Create Free Account'}
            </button>
          </form>
        )}

        <p className="text-center mt-6 text-sm text-text-secondary">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-brand hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
