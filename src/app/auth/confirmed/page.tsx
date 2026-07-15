'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

export default function ConfirmedPage() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    const finishConfirmation = async () => {
      const supabase = createClient()
      const code = new URLSearchParams(window.location.search).get('code')

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          setStatus('error')
          return
        }
      }

      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        setStatus('error')
        return
      }

      await fetch('/api/auth/profile', {
        method: 'POST',
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      })
      setStatus('ready')
    }

    finishConfirmation()
  }, [])

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-6 py-16 text-center">
      <div className="w-full rounded-3xl border border-white/10 bg-bg-card/50 p-8">
        {status === 'loading' && <><h1 className="text-3xl font-semibold">Confirming your account…</h1><p className="mt-3 text-text-secondary">This should only take a moment.</p></>}
        {status === 'ready' && <><p className="text-xs uppercase tracking-[.2em] text-brand">Email confirmed</p><h1 className="mt-3 text-3xl font-semibold">Welcome to BVS Radio</h1><p className="mt-3 text-text-secondary">Your account is ready and you are signed in.</p><Link href="/" className="mt-7 inline-block rounded-full bg-brand px-7 py-3 font-semibold text-black">Continue to BVS</Link></>}
        {status === 'error' && <><h1 className="text-3xl font-semibold">We could not confirm this link</h1><p className="mt-3 text-text-secondary">The link may have expired or been opened on a different device. Try signing in, or create the account again to receive a new link.</p><div className="mt-7 flex justify-center gap-3"><Link href="/auth/login" className="rounded-full bg-brand px-6 py-3 font-semibold text-black">Sign in</Link><Link href="/auth/signup" className="rounded-full border border-white/20 px-6 py-3">Try again</Link></div></>}
      </div>
    </main>
  )
}
