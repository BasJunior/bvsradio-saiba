'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, username }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Signup failed')
      setSuccess(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-brand/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-4">Check your email</h1>
          <p className="text-text-secondary mb-6">
            We sent a verification link to <strong className="text-text-primary">{email}</strong>.
            Click the link to activate your account.
          </p>
          <Link href="/auth/login" className="text-brand hover:underline">
            Go to Sign In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-20">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Join BVS Radio</h1>
          <p className="text-text-secondary">Create your artist account</p>
        </div>

        <form onSubmit={handleSignUp} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium mb-1">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-bg-card border border-white/10 rounded-xl focus:outline-none focus:border-brand transition-colors"
              placeholder="artistname"
              required
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-bg-card border border-white/10 rounded-xl focus:outline-none focus:border-brand transition-colors"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-bg-card border border-white/10 rounded-xl focus:outline-none focus:border-brand transition-colors"
              placeholder="Min. 6 characters"
              minLength={6}
              required
            />
          </div>

          {error && (
            <div className="bg-accent/10 border border-accent/30 rounded-xl px-4 py-3 text-sm text-accent">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand text-black font-semibold rounded-full hover:bg-brand-dark disabled:opacity-50 transition-all"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-text-secondary mt-6">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-brand hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  )
}