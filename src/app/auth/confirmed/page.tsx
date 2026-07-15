'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { EmailOtpType } from '@supabase/supabase-js'

type Status = 'loading' | 'ready' | 'error'

export default function ConfirmedPage() {
  const [status, setStatus] = useState<Status>('loading')
  const [detail, setDetail] = useState<string | null>(null)

  useEffect(() => {
    const finishConfirmation = async () => {
      try {
        const supabase = createClient()
        const url = new URL(window.location.href)
        const params = url.searchParams
        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''))

        const code = params.get('code')
        const token_hash = params.get('token_hash') || hashParams.get('token_hash')
        const type = (params.get('type') || hashParams.get('type') || 'signup') as EmailOtpType
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
        } else {
          // detectSessionInUrl may already have established a session from the hash
          await new Promise((r) => setTimeout(r, 150))
        }

        const { data, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError
        if (!data.session) {
          setDetail('No active session after opening the link. Try signing in, or request a new confirmation email.')
          setStatus('error')
          return
        }

        const profileRes = await fetch('/api/auth/profile', {
          method: 'POST',
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        })
        if (!profileRes.ok) {
          // Session is valid even if profile upsert fails — still allow entry
          console.warn('profile setup failed', await profileRes.text())
        }

        // Clean sensitive tokens from the address bar
        if (window.location.hash || params.has('code') || params.has('token_hash')) {
          window.history.replaceState({}, '', '/auth/confirmed')
        }

        setStatus('ready')
      } catch (err: unknown) {
        setDetail(err instanceof Error ? err.message : 'Confirmation failed')
        setStatus('error')
      }
    }

    finishConfirmation()
  }, [])

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-6 py-16 text-center">
      <div className="w-full rounded-3xl border border-white/10 bg-bg-card/50 p-8">
        {status === 'loading' && (
          <>
            <h1 className="text-3xl font-semibold">Confirming your account…</h1>
            <p className="mt-3 text-text-secondary">This should only take a moment.</p>
          </>
        )}
        {status === 'ready' && (
          <>
            <p className="text-xs uppercase tracking-[.2em] text-brand">Email confirmed</p>
            <h1 className="mt-3 text-3xl font-semibold">Welcome to BVS Radio</h1>
            <p className="mt-3 text-text-secondary">Your account is ready and you are signed in.</p>
            <Link href="/" className="mt-7 inline-block rounded-full bg-brand px-7 py-3 font-semibold text-black">
              Continue to BVS
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <h1 className="text-3xl font-semibold">We could not confirm this link</h1>
            <p className="mt-3 text-text-secondary">
              {detail ||
                'The link may have expired, already been used, or was opened incorrectly. Try signing in, or request a new confirmation email from signup.'}
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="/auth/login" className="rounded-full bg-brand px-6 py-3 font-semibold text-black">
                Sign in
              </Link>
              <Link href="/auth/signup" className="rounded-full border border-white/20 px-6 py-3">
                Resend via signup
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
