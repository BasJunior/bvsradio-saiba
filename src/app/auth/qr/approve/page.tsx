'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function ApproveQrLoginPage() {
  const [status, setStatus] = useState<'checking' | 'ready' | 'approving' | 'approved' | 'error'>('checking')
  const [detail, setDetail] = useState('Checking your BVS Radio account…')
  const [email, setEmail] = useState('')
  const [pairing, setPairing] = useState('')
  const [approvalToken, setApprovalToken] = useState('')
  const router = useRouter()

  useEffect(() => {
    const check = async () => {
      const url = new URL(window.location.href)
      const pairingId = url.searchParams.get('pairing') || ''
      const token = url.searchParams.get('token') || ''
      const next = `/auth/qr/approve?${new URLSearchParams({ pairing: pairingId, token }).toString()}`
      if (!pairingId || !token) {
        setStatus('error')
        setDetail('This QR login link is incomplete. Scan a new code from the computer.')
        return
      }
      setPairing(pairingId)
      setApprovalToken(token)
      const { data } = await createClient().auth.getSession()
      if (!data.session) {
        router.replace(`/auth/login?next=${encodeURIComponent(next)}`)
        return
      }
      setEmail(data.session.user.email || 'your BVS account')
      setStatus('ready')
      setDetail('Only approve if the QR code is visible on the computer in front of you.')
    }
    void check()
  }, [router])

  const approve = async () => {
    setStatus('approving')
    setDetail('Approving this computer…')
    const { data } = await createClient().auth.getSession()
    const accessToken = data.session?.access_token
    if (!accessToken) {
      setStatus('error')
      setDetail('Your phone session expired. Scan a new QR code and sign in again.')
      return
    }
    const response = await fetch('/api/auth/qr/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ pairingId: pairing, approvalToken }),
    })
    const result = await response.json()
    if (!response.ok) {
      setStatus('error')
      setDetail(result.error || 'Could not approve this computer.')
      return
    }
    window.history.replaceState({}, '', '/auth/qr/approve')
    setStatus('approved')
    setDetail('Computer approved. Return to it—it will sign in automatically.')
  }

  return (
    <main className="mx-auto flex min-h-[75vh] max-w-lg items-center px-6 py-16 text-center">
      <div className="w-full rounded-3xl border border-white/10 bg-bg-card/50 p-8">
        <p className="text-xs uppercase tracking-[.2em] text-brand">Secure device login</p>
        <h1 className="mt-3 text-3xl font-semibold">Approve this computer?</h1>
        {email ? <p className="mt-3 text-sm text-text-secondary">Signed in as <strong className="text-text-primary">{email}</strong></p> : null}
        <p className="mt-5 text-text-secondary">{detail}</p>
        {status === 'ready' ? (
          <button onClick={() => void approve()} className="mt-7 w-full rounded-full bg-brand px-7 py-3 font-semibold text-black">
            Approve computer
          </button>
        ) : null}
        {status === 'approving' || status === 'checking' ? <p className="mt-7 text-sm text-brand">Please wait…</p> : null}
        {status === 'approved' ? <Link href="/" className="mt-7 inline-block rounded-full border border-white/20 px-7 py-3">Continue on phone</Link> : null}
        {status === 'error' ? <Link href="/auth/login" className="mt-7 inline-block text-brand hover:underline">Open normal sign in</Link> : null}
      </div>
    </main>
  )
}

