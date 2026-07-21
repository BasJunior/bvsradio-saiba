'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { EmailOtpType } from '@supabase/supabase-js'

type Status = 'loading' | 'ready' | 'error'

function friendlyAuthError(code: string | null, description: string | null): string {
  const desc = (description || '').replace(/\+/g, ' ')
  if (code === 'otp_expired' || /expired|invalid/i.test(desc)) {
    return (
      'This confirmation link is invalid or has already been used. ' +
      'Inbox scanners often open the link once before you do, which burns the one-time code. ' +
      'Request a fresh confirmation from signup, then open the newest email on your phone browser (not a preview pane).'
    )
  }
  if (code === 'access_denied' || /access.denied/i.test(desc)) {
    return 'Email confirmation was denied. Request a new link from signup, or try signing in if you already confirmed.'
  }
  return desc || 'The link may have expired, already been used, or was opened incorrectly.'
}

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

        const error = params.get('error') || hashParams.get('error')
        const errorCode = params.get('error_code') || hashParams.get('error_code')
        const errorDescription =
          params.get('error_description') || hashParams.get('error_description')

        if (error || errorCode) {
          setDetail(friendlyAuthError(errorCode, errorDescription))
          setStatus('error')
          window.history.replaceState({}, '', '/auth/confirmed')
          return
        }

        const code = params.get('code')
        const token_hash = params.get('token_hash') || hashParams.get('token_hash')
        const type = (params.get('type') || hashParams.get('type') || 'signup') as EmailOtpType
        const access_token = hashParams.get('access_token')
        const refresh_token = hashParams.get('refresh_token')

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) throw exchangeError
        } else if (token_hash) {
          const { error: otpError } = await supabase.auth.verifyOtp({ token_hash, type })
          if (otpError) throw otpError
        } else if (access_token && refresh_token) {
          const { error: sessionSetError } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          })
          if (sessionSetError) throw sessionSetError
        } else {
          // detectSessionInUrl may already have established a session from the hash
          await new Promise((r) => setTimeout(r, 150))
        }

        const { data, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError
        if (!data.session) {
          setDetail(
            'No active session after opening the link. Try signing in, or request a new confirmation email from signup.',
          )
          setStatus('error')
          return
        }

        const profileRes = await fetch('/api/auth/profile', {
          method: 'POST',
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        })
        if (!profileRes.ok) {
          console.warn('profile setup failed', await profileRes.text())
        }

        if (window.location.hash || params.has('code') || params.has('token_hash')) {
          window.history.replaceState({}, '', '/auth/confirmed')
        }

        setStatus('ready')
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Confirmation failed'
        setDetail(friendlyAuthError(null, message))
        setStatus('error')
      }
    }

    void finishConfirmation()
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
            <p className="mt-3 text-left text-text-secondary">{detail}</p>
            <ol className="mt-4 list-decimal space-y-2 px-4 text-left text-sm text-text-secondary">
              <li>Open signup again and use Resend confirmation (or sign up with the same email).</li>
              <li>Use the newest email only — older links stay expired.</li>
              <li>Open the link in a real browser tab (not the mail app preview).</li>
            </ol>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="/auth/signup" className="rounded-full bg-brand px-6 py-3 font-semibold text-black">
                Resend confirmation
              </Link>
              <Link href="/auth/login" className="rounded-full border border-white/20 px-6 py-3">
                Sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
