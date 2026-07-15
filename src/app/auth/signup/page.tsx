'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'

export default function SignupPage() {
  const [form, setForm] = useState({ email: '', password: '', fullName: '', username: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null)
  const [resendMessage, setResendMessage] = useState<string | null>(null)

  const resendConfirmation = async () => {
    if (!verificationEmail) return
    setResendMessage('Sending…')
    const supabase = createClient()
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: verificationEmail,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirmed` },
    })
    setResendMessage(resendError ? resendError.message : 'A new confirmation link was sent.')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error: signupError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirmed`,
          data: {
            username: form.username,
            full_name: form.fullName,
            role: 'artist',
          },
        },
      })
      if (signupError) throw signupError
      setVerificationEmail(form.email)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <Image src="/assets/images/Bvsradio_logo.png" alt="BVS Radio" width={40} height={40} />
            <span className="text-2xl font-bold text-brand">BVS Radio</span>
          </Link>
          <h1 className="text-3xl font-bold">Join the movement</h1>
          <p className="text-text-secondary mt-1">Create your free account to upload music and connect.</p>
        </div>

        {verificationEmail ? (
          <div className="rounded-2xl border border-brand/30 bg-brand/10 p-6 text-center">
            <h2 className="text-xl font-semibold">Check your email</h2>
            <p className="mt-3 text-sm text-text-secondary">We sent a confirmation link to <strong className="text-text-primary">{verificationEmail}</strong>. Open it on this device to finish creating your account.</p>
            <p className="mt-4 text-xs text-text-secondary">Also check Spam or Promotions. The link may take a minute to arrive.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-4 text-sm">
              <button type="button" onClick={resendConfirmation} className="text-brand hover:underline">Resend confirmation</button>
              <button type="button" onClick={() => setVerificationEmail(null)} className="text-brand hover:underline">Use a different email</button>
            </div>
            {resendMessage && <p className="mt-3 text-xs text-text-secondary">{resendMessage}</p>}
          </div>
        ) : <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" placeholder="Full name" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} required className="w-full bg-bg-card border border-white/10 focus:border-brand px-4 py-3 rounded-xl outline-none" />
          <input type="text" placeholder="Username" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required className="w-full bg-bg-card border border-white/10 focus:border-brand px-4 py-3 rounded-xl outline-none" />
          <input type="email" placeholder="Email address" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required className="w-full bg-bg-card border border-white/10 focus:border-brand px-4 py-3 rounded-xl outline-none" />
          <input type="password" placeholder="Create a password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required className="w-full bg-bg-card border border-white/10 focus:border-brand px-4 py-3 rounded-xl outline-none" />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button type="submit" disabled={loading} className="w-full py-3.5 mt-2 bg-brand hover:bg-brand-dark disabled:opacity-70 text-black font-semibold rounded-full transition-all">
            {loading ? "Creating account..." : "Create Free Account"}
          </button>
        </form>}

        <p className="text-center mt-6 text-sm text-text-secondary">Already have an account? <Link href="/auth/login" className="text-brand hover:underline">Sign in</Link></p>
      </div>
    </div>
  )
}
