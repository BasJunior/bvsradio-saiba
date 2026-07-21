'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/'
  return raw
}

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nextPath, setNextPath] = useState('/')
  const [alreadyIn, setAlreadyIn] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    setNextPath(safeNextPath(params.get('next')))
    if (!isSupabaseConfigured()) return
    void createClient().auth.getSession().then(({ data }) => {
      const email = data.session?.user?.email
      if (email) setAlreadyIn(email)
    })
  }, [])

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

      router.push(nextPath || '/')
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
            <Image src="/logo.png" alt="BVS Radio" width={40} height={40} priority />
            <span className="text-2xl font-bold text-brand">BVS Radio</span>
          </Link>
          <h1 className="text-3xl font-bold">Welcome back</h1>
          <p className="text-text-secondary mt-1">
            Sign in with your <strong className="text-text-primary">email or username</strong> and
            password.
          </p>
          {alreadyIn ? (
            <p className="mt-4 rounded-xl border border-brand/30 bg-brand/10 px-4 py-3 text-sm text-text-secondary">
              Already signed in as <strong className="text-text-primary">{alreadyIn}</strong>.{' '}
              <Link href={nextPath || '/'} className="text-brand hover:underline">
                Continue
              </Link>{' '}
              or sign in with a different account below.
            </p>
          ) : null}
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
