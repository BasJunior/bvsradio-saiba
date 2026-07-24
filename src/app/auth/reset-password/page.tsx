'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { EmailOtpType } from '@supabase/supabase-js'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const establishSession = async () => {
      try {
        const supabase = createClient()
        const url = new URL(window.location.href)
        const params = url.searchParams
        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''))

        const code = params.get('code')
        const token_hash = params.get('token_hash') || hashParams.get('token_hash')
        const type = (params.get('type') || hashParams.get('type') || 'recovery') as EmailOtpType
        const access_token = hashParams.get('access_token')
        const refresh_token = hashParams.get('refresh_token')

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
        } else if (token_hash) {
          const { error } = await supabase.auth.verifyOtp({ token_hash, type })
          if (error) throw error
        } else if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token })
          if (error) throw error
        }

        const { data } = await supabase.auth.getSession()
        if (!data.session) {
          setError('This reset link is invalid or expired. Request a new one.')
          return
        }
        window.history.replaceState({}, '', '/auth/reset-password')
        setReady(true)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Could not open reset link')
      }
    }
    establishSession()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      setDone(true)
      setTimeout(() => router.push('/'), 1500)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <Image src="/branding/bvs-logo.png" alt="BVS Radio" width={1032} height={552} className="h-14 w-auto rounded-md object-contain" priority />
          </Link>
          <h1 className="text-3xl font-bold">Choose a new password</h1>
        </div>

        {done ? (
          <p className="text-center text-brand" role="status">
            Password updated. Taking you to BVS…
          </p>
        ) : !ready && !error ? (
          <p className="text-center text-text-secondary">Validating reset link…</p>
        ) : error && !ready ? (
          <div className="text-center">
            <p className="text-red-400" role="alert">
              {error}
            </p>
            <Link href="/auth/forgot-password" className="mt-4 inline-block text-brand hover:underline">
              Request a new link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password (min 8 characters)"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full bg-bg-card border border-white/10 focus:border-brand px-4 py-3 rounded-xl outline-none"
            />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm new password"
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
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-brand hover:bg-brand-dark disabled:opacity-70 text-black font-semibold rounded-full"
            >
              {loading ? 'Saving…' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
