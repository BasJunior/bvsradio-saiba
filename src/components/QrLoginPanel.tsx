'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { createClient } from '@/lib/supabase'

type Pairing = {
  pairingId: string
  pollToken: string
  qrUrl: string
  expiresAt: string
}

export default function QrLoginPanel({ nextPath }: { nextPath: string }) {
  const [open, setOpen] = useState(false)
  const [pairing, setPairing] = useState<Pairing | null>(null)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const generation = useRef(0)
  const router = useRouter()

  useEffect(() => {
    if (!open || !pairing) return
    const current = ++generation.current
    const poll = async () => {
      try {
        const response = await fetch('/api/auth/qr/poll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pairingId: pairing.pairingId, pollToken: pairing.pollToken }),
          cache: 'no-store',
        })
        const data = await response.json()
        if (generation.current !== current) return
        if (data.status === 'approved' && data.tokenHash) {
          setStatus('Phone approved. Signing in this computer…')
          const { error } = await createClient().auth.verifyOtp({
            token_hash: data.tokenHash,
            type: 'magiclink',
          })
          if (error) throw error
          generation.current += 1
          router.replace(nextPath || '/')
          router.refresh()
          return
        }
        if (data.status === 'expired' || response.status === 410) {
          generation.current += 1
          setStatus('This QR code expired. Create a new one.')
          setPairing(null)
          return
        }
      } catch (error) {
        console.error('QR login polling failed', error)
      }
      if (generation.current === current) window.setTimeout(poll, 1500)
    }
    const timer = window.setTimeout(poll, 800)
    return () => {
      window.clearTimeout(timer)
      if (generation.current === current) generation.current += 1
    }
  }, [open, pairing, nextPath, router])

  const start = async () => {
    setBusy(true)
    setStatus('Creating a secure one-time code…')
    try {
      const response = await fetch('/api/auth/qr/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ next: nextPath }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not create QR login.')
      setPairing(data)
      setStatus('Scan with your phone, sign in if asked, then approve this computer.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not create QR login.')
    } finally {
      setBusy(false)
    }
  }

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && !pairing) void start()
    if (!next) generation.current += 1
  }

  return (
    <div className="mb-6 rounded-2xl border border-white/10 bg-white/[.025] p-4 text-center">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="bvs-qr-login"
        className="w-full rounded-full border border-white/15 px-4 py-2.5 text-sm font-semibold hover:border-brand hover:text-brand"
      >
        {open ? 'Hide QR code' : 'Sign in this computer using your phone'}
      </button>
      {open ? (
        <div id="bvs-qr-login" className="mt-4" aria-live="polite">
          {pairing ? (
            <div className="mx-auto w-fit rounded-2xl bg-white p-4">
              <QRCodeSVG
                value={pairing.qrUrl}
                size={190}
                level="H"
                marginSize={1}
                bgColor="#ffffff"
                fgColor="#0a0a0a"
                title="BVS Radio secure computer login QR code"
                imageSettings={{
                  // Square app mark reads cleanly in the quiet zone; wide wordmark would crush.
                  src: '/bvs-icon-v2-192.png',
                  height: 40,
                  width: 40,
                  excavate: true,
                }}
              />
            </div>
          ) : null}
          <p className="mx-auto mt-3 max-w-xs text-xs text-text-secondary">{status}</p>
          {!pairing && !busy ? (
            <button type="button" onClick={() => void start()} className="mt-3 text-sm font-semibold text-brand hover:underline">
              Create a new QR code
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

