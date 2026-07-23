'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import { getAuthCallbackUrl } from '@/lib/auth-url'

export default function SignupPage() {
  const [form, setForm] = useState({ email: '', password: '', fullName: '', username: '', role: 'listener' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null)
  const [resendMessage, setResendMessage] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const redirectTo = getAuthCallbackUrl('/auth/confirmed')

  const resendConfirmation = async () => {
    if (!verificationEmail) return
    setResendMessage('Sending…')
    const supabase = createClient()
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: verificationEmail,
      options: { emailRedirectTo: redirectTo },
    })
    setResendMessage(
      resendError
        ? resendError.message
        : 'A new confirmation link was sent. Check inbox and Spam.',
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setInfo(null)

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
      const supabase = createClient()
      const { data, error: signupError } = await supabase.auth.signUp({
        email,
        password: form.password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            username,
            full_name: form.fullName.trim(),
            role: form.role,
          },
        },
      })
      if (signupError) {
        const m = signupError.message || 'Signup failed'
        if (/pattern|invalid|email/i.test(m)) {
          throw new Error('Email or username format was rejected. Use a normal email (you@domain.com) and a simple username without spaces.')
        }
        throw signupError
      }

      // Supabase returns a user with empty identities when the email is already registered
      const identities = data.user?.identities
      if (data.user && Array.isArray(identities) && identities.length === 0) {
        setError('An account with this email already exists. Sign in, or use Forgot password.')
        return
      }

      if (data.session) {
        // Email confirmations disabled in Supabase — go straight in
        await fetch('/api/auth/profile', {
          method: 'POST',
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        })
        setInfo('Account created — you are signed in.')
        window.location.href = '/'
        return
      }

      setVerificationEmail(form.email.trim())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <Image src="/branding/bvs-logo.png" alt="BVS Radio" width={1032} height={552} className="h-14 w-auto rounded-md object-contain" priority />
            <span className="text-2xl font-bold text-brand">BVS Radio</span>
          </Link>
          <h1 className="text-3xl font-bold">Join the movement</h1>
          <p className="text-text-secondary mt-1">Create your free account to upload music and connect.</p>
        </div>

        {verificationEmail ? (
          <div className="rounded-2xl border border-brand/30 bg-brand/10 p-6 text-center" role="status">
            <h2 className="text-xl font-semibold">Check your email</h2>
            <p className="mt-3 text-sm text-text-secondary">
              We sent a confirmation link to{' '}
              <strong className="text-text-primary">{verificationEmail}</strong>.
              Open it to finish creating your account.
            </p>
            <p className="mt-4 text-xs text-text-secondary">
              Also check Spam or Promotions. The link should open on <strong>bvsradio.com</strong>, not localhost.
              Open the newest email in a full browser tab (mail previews can burn the one-time link).
              If you see &quot;otp_expired&quot; or invalid link, use Resend below and ignore older emails.
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
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <label className="block text-sm font-medium">I am joining as<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-bg-card px-4 py-3 outline-none focus:border-brand"><option value="listener">Listener — discover, save and interact</option><option value="artist">Artist — submit music and use creator tools</option><option value="writer">Writer — pitch and publish stories</option><option value="show_creator">Show or podcast creator — upload weekly episodes</option></select><span className="mt-2 block text-xs text-text-secondary">This sets up your starting workspace. Every account can still listen and discover.</span></label>
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

            {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
            {info && <p className="text-sm text-brand" role="status">{info}</p>}

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
