'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!isSupabaseConfigured()) {
      setError('Account service is not configured. Please try again later.')
      setLoading(false)
      return
    }

    try {
      const supabase = createClient()
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (loginError) {
        const msg = loginError.message || 'Login failed'
        if (/confirm|not confirmed|email not confirmed/i.test(msg)) {
          throw new Error(
            'Email not confirmed yet. Check your inbox for the confirmation link, or use Resend on the signup page.',
          )
        }
        if (/invalid login credentials/i.test(msg)) {
          throw new Error(
            'Invalid email or password. Use the password from signup (not your IONOS mail password). Or use Forgot password.',
          )
        }
        throw loginError
      }

      if (data.session) {
        await fetch('/api/auth/profile', {
          method: 'POST',
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        }).catch(() => null)
      }

      router.push('/')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <Image src="/assets/images/Bvsradio_logo.png" alt="BVS Radio" width={40} height={40} />
            <span className="text-2xl font-bold text-brand">BVS Radio</span>
          </Link>
          <h1 className="text-3xl font-bold">Welcome back</h1>
          <p className="text-text-secondary mt-1">Sign in to access your account and favourite tracks.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            required
            autoComplete="email"
            className="w-full bg-bg-card border border-white/10 focus:border-brand px-4 py-3 rounded-xl outline-none"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            autoComplete="current-password"
            className="w-full bg-bg-card border border-white/10 focus:border-brand px-4 py-3 rounded-xl outline-none"
          />

          <div className="flex justify-end">
            <Link href="/auth/forgot-password" className="text-sm text-brand hover:underline">
              Forgot password?
            </Link>
          </div>

          {error && (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 mt-2 bg-brand hover:bg-brand-dark disabled:opacity-70 text-black font-semibold rounded-full transition-all"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 text-center text-sm">
          Don&apos;t have an account?{' '}
          <Link href="/auth/signup" className="text-brand hover:underline">
            Join for free
          </Link>
        </div>
      </div>
    </div>
  )
}
