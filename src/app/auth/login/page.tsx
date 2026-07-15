'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('')
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

    const id = identifier.trim()
    if (!id) {
      setError('Enter your email or username.')
      setLoading(false)
      return
    }

    try {
      // Server resolves username → email, then authenticates
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: id, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Login failed')
      }

      const access_token = data.session?.access_token
      const refresh_token = data.session?.refresh_token
      if (!access_token || !refresh_token) {
        throw new Error('Login succeeded but no session was returned.')
      }

      const supabase = createClient()
      const { error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      })
      if (sessionError) throw sessionError

      // Ensure profile row exists (best effort)
      await fetch('/api/auth/profile', {
        method: 'POST',
        headers: { Authorization: `Bearer ${access_token}` },
      }).catch(() => null)

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
          <p className="text-text-secondary mt-1">
            Sign in with your <strong className="text-text-primary">email or username</strong> and
            password.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="login-identifier" className="mb-1.5 block text-sm text-text-secondary">
              Email or username
            </label>
            <input
              id="login-identifier"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="you@email.com or your_username"
              required
              autoComplete="username"
              className="w-full bg-bg-card border border-white/10 focus:border-brand px-4 py-3 rounded-xl outline-none"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="mb-1.5 block text-sm text-text-secondary">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password from signup"
              required
              autoComplete="current-password"
              className="w-full bg-bg-card border border-white/10 focus:border-brand px-4 py-3 rounded-xl outline-none"
            />
          </div>

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

        <div className="mt-8 text-center text-sm text-text-secondary">
          Don&apos;t have an account?{' '}
          <Link href="/auth/signup" className="text-brand hover:underline">
            Join for free
          </Link>
        </div>
        <p className="mt-4 text-center text-xs text-text-secondary">
          Username is the one you chose at signup. Password is not your IONOS or Gmail password.
        </p>
      </div>
    </div>
  )
}
