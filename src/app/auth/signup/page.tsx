'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function SignupPage() {
  const [form, setForm] = useState({ email: '', password: '', fullName: '', username: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Signup failed')
      router.push('/')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" placeholder="Full name" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} required className="w-full bg-bg-card border border-white/10 focus:border-brand px-4 py-3 rounded-xl outline-none" />
          <input type="text" placeholder="Username" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required className="w-full bg-bg-card border border-white/10 focus:border-brand px-4 py-3 rounded-xl outline-none" />
          <input type="email" placeholder="Email address" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required className="w-full bg-bg-card border border-white/10 focus:border-brand px-4 py-3 rounded-xl outline-none" />
          <input type="password" placeholder="Create a password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required className="w-full bg-bg-card border border-white/10 focus:border-brand px-4 py-3 rounded-xl outline-none" />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button type="submit" disabled={loading} className="w-full py-3.5 mt-2 bg-brand hover:bg-brand-dark disabled:opacity-70 text-black font-semibold rounded-full transition-all">
            {loading ? "Creating account..." : "Create Free Account"}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-text-secondary">Already have an account? <Link href="/auth/login" className="text-brand hover:underline">Sign in</Link></p>
      </div>
    </div>
  )
}
