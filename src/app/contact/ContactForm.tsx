'use client'

import { FormEvent, useEffect, useState } from 'react'

const topicOptions = [
  ['general', 'General inquiry'],
  ['music', 'Music submission / collaboration'],
  ['business', 'Business or advertising'],
  ['press', 'Press or interview request'],
  ['technical', 'Technical issue'],
  ['account', 'Account support'],
  ['account_deletion', 'Account deletion'],
  ['other', 'Other'],
]

export default function ContactForm() {
  const [form, setForm] = useState({ name: '', email: '', topic: 'general', message: '', website: '' })
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('topic')?.replaceAll('-', '_')
    if (requested && topicOptions.some(([value]) => value === requested)) {
      setForm((current) => ({ ...current, topic: requested }))
    }
  }, [])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSending(true)
    setError('')
    setSuccess('')
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Could not send your message.')
      setSuccess(`Message received. Your reference is ${payload.reference}. A copy was emailed to you.`)
      setForm((current) => ({ ...current, message: '', website: '' }))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not send your message.')
    } finally {
      setSending(false)
    }
  }

  return (
    <form
      className="space-y-5 bg-bg-card/30 border border-white/10 p-8 rounded-2xl" 
      onSubmit={handleSubmit}
    >
      <label className="sr-only" aria-hidden="true">
        Website
        <input tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} />
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm mb-1.5 block">Your Name</label>
          <input 
            type="text" 
            required 
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            className="w-full bg-bg-primary border border-white/10 rounded-xl px-4 py-3 focus:border-brand outline-none" 
            placeholder="Aisha Moyo" 
          />
        </div>
        <div>
          <label className="text-sm mb-1.5 block">Email Address</label>
          <input 
            type="email" 
            required 
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            className="w-full bg-bg-primary border border-white/10 rounded-xl px-4 py-3 focus:border-brand outline-none" 
            placeholder="you@email.com" 
          />
        </div>
      </div>

      <div>
        <label className="text-sm mb-1.5 block">What are you reaching out about?</label>
        <select value={form.topic} onChange={(event) => setForm({ ...form, topic: event.target.value })} className="w-full bg-bg-primary border border-white/10 rounded-xl px-4 py-3 focus:border-brand outline-none text-text-primary">
          {topicOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      <div>
        <label className="text-sm mb-1.5 block">Message</label>
        <textarea 
          required 
          minLength={10}
          maxLength={5000}
          value={form.message}
          onChange={(event) => setForm({ ...form, message: event.target.value })}
          rows={6} 
          className="w-full bg-bg-primary border border-white/10 rounded-xl px-4 py-3 focus:border-brand outline-none resize-y" 
          placeholder="Tell us what's on your mind..."
        />
      </div>

      {error && <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200" role="alert">{error}</p>}
      {success && <p className="rounded-xl border border-brand/30 bg-brand/10 p-3 text-sm text-brand" role="status">{success}</p>}
      <button
        type="submit" 
        disabled={sending}
        className="w-full py-3.5 bg-brand hover:bg-brand-dark text-black font-semibold rounded-full text-lg mt-2 transition-all"
      >
        {sending ? 'Sending…' : 'Send Message'}
      </button>
      <p className="text-center text-xs text-text-secondary">We usually reply within 1–2 business days.</p>
    </form>
  );
}
