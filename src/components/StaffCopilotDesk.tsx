'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import type { StaffCopilotCitation, StaffCopilotSuggestedLink, StaffCopilotToolTrace } from '@/lib/staff-copilot/types'

type UiMessage = { role: 'user' | 'assistant'; content: string; citations?: StaffCopilotCitation[]; trace?: StaffCopilotToolTrace[]; links?: StaffCopilotSuggestedLink[] }

export default function StaffCopilotDesk() {
  const [token, setToken] = useState('')
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [threadId, setThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const remaining = 2000 - input.length
  const configured = useMemo(() => isSupabaseConfigured(), [])

  useEffect(() => {
    if (!configured) { queueMicrotask(() => setError('Supabase client is not configured.')); return }
    const supabase = createClient()
    void supabase.auth.getSession().then(async ({ data }) => {
      const accessToken = data.session?.access_token || ''
      if (!accessToken) { setError('Sign in with an active BVS staff account.'); return }
      const response = await fetch('/api/staff/copilot?tools=1', { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' })
      if (!response.ok) {
        setError(response.status === 403 ? 'This beta tool is restricted to active BVS staff.' : 'Sign in with an active BVS staff account.')
        return
      }
      setToken(accessToken); setReady(true)
    }).catch(() => setError('Could not verify staff access.'))
  }, [configured])

  const newThread = () => { setThreadId(null); setMessages([]); setInput(''); setError('') }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const message = input.trim()
    if (!message || busy || !token) return
    setBusy(true); setError(''); setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: message }])
    try {
      const response = await fetch('/api/staff/copilot', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, threadId, clientContext: { path: window.location.pathname, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } }),
      })
      const payload = await response.json() as { threadId?: string; reply?: string; error?: string; citations?: StaffCopilotCitation[]; suggestedLinks?: StaffCopilotSuggestedLink[]; toolTrace?: StaffCopilotToolTrace[] }
      if (!response.ok) throw new Error(payload.error || 'Ops Copilot request failed.')
      setThreadId(payload.threadId || threadId)
      setMessages((prev) => [...prev, { role: 'assistant', content: payload.reply || 'No reply returned.', citations: payload.citations, trace: payload.toolTrace, links: payload.suggestedLinks }])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Ops Copilot request failed.')
    } finally { setBusy(false) }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="rounded-2xl border border-amber-300/40 bg-amber-300/10 p-4 text-amber-100">
        <p className="text-xs font-bold uppercase tracking-[.2em]">STAFF ONLY · BETA · READ TOOLS</p>
        <p className="mt-2 text-sm text-text-secondary">Ops Copilot can inspect beta facts through a fixed allowlist. It cannot approve, publish, refund, deploy, rotate keys, force live, run shell commands or execute arbitrary SQL.</p>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs uppercase tracking-[.18em] text-brand">BVS operations</p><h1 className="mt-1 text-3xl font-semibold">Ops Copilot</h1></div>
        <div className="flex gap-2"><Link href="/beta/qa" className="rounded-full border border-white/15 px-4 py-2 text-sm">Beta QA</Link><button type="button" onClick={newThread} className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-black">New thread</button></div>
      </div>

      {error ? <p className="mt-5 rounded-xl border border-red-300/30 bg-red-300/5 p-4 text-sm text-red-100">{error}</p> : null}
      {!ready && !error ? <p className="mt-6 text-sm text-text-secondary">Verifying staff access…</p> : null}

      {ready ? <>
        <section className="mt-6 min-h-[22rem] space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-6">
          {!messages.length ? <div className="grid gap-3 sm:grid-cols-2"><button className="rounded-xl border border-white/10 p-4 text-left text-sm hover:border-brand/40" onClick={() => setInput('What live shows are ARMED or LIVE?')}>What live shows are ARMED or LIVE?</button><button className="rounded-xl border border-white/10 p-4 text-left text-sm hover:border-brand/40" onClick={() => setInput('Summarize the pending editorial queues.')}>Summarize pending queues</button><button className="rounded-xl border border-white/10 p-4 text-left text-sm hover:border-brand/40" onClick={() => setInput('Show beta QA health and deployment identity.')}>Check beta QA health</button><button className="rounded-xl border border-white/10 p-4 text-left text-sm hover:border-brand/40" onClick={() => setInput('Show recent upload failures.')}>Show upload failures</button></div> : null}
          {messages.map((message, index) => <article key={index} className={`rounded-2xl p-4 ${message.role === 'user' ? 'ml-auto max-w-3xl bg-brand/10' : 'mr-auto max-w-4xl border border-white/10 bg-bg-secondary'}`}>
            <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-text-secondary">{message.role === 'user' ? 'You' : 'Ops Copilot'}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.content}</p>
            {message.citations?.length ? <div className="mt-3 flex flex-wrap gap-2">{message.citations.map((citation, i) => <span key={`${citation.name}-${i}`} className="rounded-full border border-white/10 px-2 py-1 font-mono text-[10px] text-text-secondary">{citation.type}:{citation.name}</span>)}</div> : null}
            {message.links?.length ? <div className="mt-3 flex flex-wrap gap-2">{message.links.map((link) => <Link key={link.href} href={link.href} className="text-xs font-semibold text-brand">{link.label} →</Link>)}</div> : null}
            {message.trace?.length ? <details className="mt-3"><summary className="cursor-pointer text-xs text-text-secondary">Tool trace ({message.trace.length})</summary><div className="mt-2 space-y-1 font-mono text-[11px] text-text-secondary">{message.trace.map((item, i) => <p key={`${item.tool}-${i}`}>{item.tool} · {item.status} · {item.ms}ms</p>)}</div></details> : null}
          </article>)}
        </section>

        <form onSubmit={submit} className="mt-4 rounded-2xl border border-white/10 p-3">
          <textarea value={input} onChange={(e) => setInput(e.target.value.slice(0, 2000))} rows={4} placeholder="Ask about beta queues, live state, QA, orders, memberships, creators or upload failures…" className="w-full resize-none bg-transparent p-2 text-sm outline-none" />
          <div className="flex items-center justify-between gap-3"><span className={`text-xs ${remaining < 100 ? 'text-amber-200' : 'text-text-secondary'}`}>{remaining} characters left</span><button type="submit" disabled={busy || !input.trim()} className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-black disabled:opacity-50">{busy ? 'Reading beta…' : 'Ask Ops Copilot'}</button></div>
        </form>
      </> : null}
    </div>
  )
}
