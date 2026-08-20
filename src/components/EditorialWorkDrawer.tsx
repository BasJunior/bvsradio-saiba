'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'

export type EditorialCommandItem = {
  id: string
  kind: string
  title: string
  subtitle: string
  status?: string
  section: string
  createdAt?: string
  priority: number
  keywords: string[]
}

type Related = { label: string; value: string; meta?: string }
type Field = { label: string; value: string }
type QuickAction = {
  id: string
  label: string
  tone?: 'default' | 'positive' | 'warning' | 'danger'
  action: string
  body: Record<string, unknown>
  noteKey?: string
  noteRequired?: boolean
  confirm?: string
}

type WorkItem = {
  kind: string
  id: string
  title: string
  subtitle?: string
  status?: string
  section: string
  createdAt?: string
  artwork?: string
  audio?: string
  description?: string
  fields: Field[]
  related: Related[]
  audit: Related[]
  quickActions: QuickAction[]
}

type WorkResponse = {
  item: WorkItem
  identity: { role: string; permissions: string[] }
  error?: string
}

function workObjectId(item: EditorialCommandItem) {
  if (item.kind === 'artist_name' || item.kind === 'producer_name') return item.id.split(':')[0] || item.id
  return item.id
}

function ageLabel(value?: string) {
  if (!value) return ''
  const time = Date.parse(value)
  if (!Number.isFinite(time)) return ''
  const diff = Math.max(0, Date.now() - time)
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return days < 30 ? `${days}d ago` : new Date(time).toLocaleDateString()
}

function toneClass(tone?: QuickAction['tone']) {
  if (tone === 'positive') return 'border-emerald-300/40 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300/15'
  if (tone === 'warning') return 'border-amber-300/40 bg-amber-300/10 text-amber-100 hover:bg-amber-300/15'
  if (tone === 'danger') return 'border-red-300/40 bg-red-300/10 text-red-100 hover:bg-red-300/15'
  return 'border-white/15 text-text-primary hover:border-brand/40 hover:text-brand'
}

export default function EditorialWorkDrawer({
  command,
  queue,
  onClose,
  onSelect,
  onOpenFull,
  onMutated,
}: {
  command: EditorialCommandItem
  queue: EditorialCommandItem[]
  onClose: () => void
  onSelect: (item: EditorialCommandItem) => void
  onOpenFull: (item: EditorialCommandItem) => void
  onMutated: () => void | Promise<void>
}) {
  const [work, setWork] = useState<WorkItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notes, setNotes] = useState('')
  const [acting, setActing] = useState('')
  const closeRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)

  const currentIndex = useMemo(
    () => queue.findIndex((item) => item.kind === command.kind && item.id === command.id),
    [command.id, command.kind, queue],
  )
  const previous = currentIndex > 0 ? queue[currentIndex - 1] : undefined
  const next = currentIndex >= 0 && currentIndex < queue.length - 1 ? queue[currentIndex + 1] : undefined

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await createClient().auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('Your editorial session expired. Sign in again.')
      const response = await fetch(
        `/api/admin/editorial/work-item?kind=${encodeURIComponent(command.kind)}&id=${encodeURIComponent(workObjectId(command))}`,
        { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
      )
      const body = (await response.json()) as WorkResponse
      if (!response.ok) throw new Error(body.error || 'Could not load this editorial work item.')
      setWork(body.item)
    } catch (caught) {
      setWork(null)
      setError(caught instanceof Error ? caught.message : 'Could not load this editorial work item.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setNotes('')
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command.id, command.kind])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const timer = window.setTimeout(() => closeRef.current?.focus(), 0)
    return () => {
      window.clearTimeout(timer)
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),audio[controls],[tabindex]:not([tabindex="-1"])'))
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const runAction = async (action: QuickAction) => {
    if (action.noteRequired && notes.trim().length < 3) {
      setError('Add a short editorial note before taking this action.')
      return
    }
    if (action.confirm && !window.confirm(action.confirm)) return
    setActing(action.id)
    setError('')
    try {
      const { data } = await createClient().auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('Your editorial session expired. Sign in again.')
      const body: Record<string, unknown> = { action: action.action, ...action.body }
      if (action.noteKey) body[action.noteKey] = notes.trim()
      const response = await fetch('/api/admin/editorial', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      const payload = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(payload.error || 'Editorial action failed.')
      setNotes('')
      await Promise.all([load(), Promise.resolve(onMutated())])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Editorial action failed.')
    } finally {
      setActing('')
    }
  }

  const hasNoteActions = Boolean(work?.quickActions.some((action) => action.noteKey))

  return (
    <div className="fixed inset-0 z-[140] bg-black/70 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="editorial-work-title"
        className="ml-auto flex h-[100dvh] w-full max-w-[46rem] flex-col border-l border-white/10 bg-bg-primary shadow-2xl"
      >
        <header className="border-b border-white/10 px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">Editorial work object</p>
              <h2 id="editorial-work-title" className="mt-1 truncate text-2xl font-semibold">{work?.title || command.title}</h2>
              <p className="mt-1 text-sm text-text-secondary">{work?.subtitle || command.subtitle}</p>
            </div>
            <button ref={closeRef} type="button" onClick={onClose} aria-label="Close work item" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/10 text-xl hover:border-brand">×</button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            {(work?.status || command.status) ? <span className="rounded-full border border-amber-300/25 bg-amber-300/[.06] px-3 py-1.5 text-amber-100">{String(work?.status || command.status).replaceAll('_', ' ')}</span> : null}
            {command.priority > 0 ? <span className="rounded-full border border-brand/25 px-3 py-1.5 text-brand">Needs action</span> : null}
            {(work?.createdAt || command.createdAt) ? <span className="text-text-secondary">{ageLabel(work?.createdAt || command.createdAt)}</span> : null}
            {currentIndex >= 0 ? <span className="ml-auto text-text-secondary">{currentIndex + 1} of {queue.length}</span> : null}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {loading ? <div className="rounded-2xl border border-white/10 p-8 text-center text-sm text-text-secondary">Loading exact work object…</div> : null}
          {error ? <div className="mb-4 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100"><p>{error}</p>{!loading ? <button type="button" onClick={() => void load()} className="mt-3 rounded-full border border-red-300/30 px-3 py-1.5 text-xs">Retry</button> : null}</div> : null}

          {work ? (
            <div className="space-y-6">
              {(work.artwork || work.audio) ? (
                <section className="grid gap-4 rounded-2xl border border-white/10 bg-white/[.02] p-4 sm:grid-cols-[9rem_1fr]">
                  {work.artwork ? <div className="relative aspect-square overflow-hidden rounded-xl bg-white/5"><Image src={work.artwork} alt="" fill unoptimized={/^https?:\/\//i.test(work.artwork)} className="object-cover" /></div> : <div className="grid aspect-square place-items-center rounded-xl bg-white/5 text-xs text-text-secondary">No artwork</div>}
                  <div className="min-w-0 self-center">
                    {work.description ? <p className="text-sm leading-relaxed text-text-secondary">{work.description}</p> : null}
                    {work.audio ? <audio controls preload="none" src={work.audio} className="mt-4 h-10 w-full max-w-full" /> : null}
                  </div>
                </section>
              ) : work.description ? <p className="rounded-2xl border border-white/10 bg-white/[.02] p-4 text-sm leading-relaxed text-text-secondary">{work.description}</p> : null}

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Snapshot</h3>
                <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                  {work.fields.map((field) => <div key={`${field.label}:${field.value}`} className="rounded-xl border border-white/10 bg-white/[.02] p-3"><dt className="text-[10px] uppercase tracking-wider text-text-secondary">{field.label}</dt><dd className="mt-1 break-words text-sm">{field.value}</dd></div>)}
                </dl>
              </section>

              {work.related.length ? (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Related work context</h3>
                  <div className="mt-3 max-h-80 space-y-2 overflow-y-auto rounded-2xl border border-white/10 p-3">
                    {work.related.map((row, index) => <div key={`${row.label}:${row.value}:${index}`} className="rounded-xl bg-white/[.03] p-3"><div className="flex flex-wrap items-start justify-between gap-2"><p className="text-sm font-medium">{row.label}</p>{row.meta ? <span className="text-[10px] uppercase tracking-wider text-text-secondary">{row.meta}</span> : null}</div><p className="mt-1 whitespace-pre-wrap break-words text-xs text-text-secondary">{row.value}</p></div>)}
                  </div>
                </section>
              ) : null}

              {work.quickActions.length ? (
                <section className="rounded-2xl border border-brand/20 bg-brand/[.035] p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Quick editorial actions</h3>
                  <p className="mt-1 text-xs text-text-secondary">These call the existing audited editorial API. Complex rights, release and metadata decisions stay in the full panel.</p>
                  {hasNoteActions ? <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Editorial note for actions that need context…" className="mt-4 min-h-24 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm outline-none focus:border-brand" /> : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {work.quickActions.map((action) => <button key={action.id} type="button" disabled={Boolean(acting)} onClick={() => void runAction(action)} className={`min-h-10 rounded-full border px-4 py-2 text-xs font-semibold disabled:opacity-40 ${toneClass(action.tone)}`}>{acting === action.id ? 'Working…' : action.label}</button>)}
                  </div>
                </section>
              ) : null}

              {work.audit.length ? (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Recent audit</h3>
                  <div className="mt-3 space-y-2">
                    {work.audit.map((row, index) => <div key={`${row.label}:${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs"><span>{row.label}</span><span className="text-text-secondary">{row.value}</span></div>)}
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}
        </div>

        <footer className="border-t border-white/10 bg-bg-primary px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={!previous} onClick={() => previous && onSelect(previous)} className="min-h-11 rounded-full border border-white/10 px-4 py-2 text-xs disabled:opacity-30">← Previous</button>
            <button type="button" onClick={() => onOpenFull(command)} className="min-h-11 rounded-full border border-brand/30 px-4 py-2 text-xs text-brand">Open full panel</button>
            <button type="button" disabled={!next} onClick={() => next && onSelect(next)} className="ml-auto min-h-11 rounded-full bg-brand px-4 py-2 text-xs font-semibold text-black disabled:opacity-30">Next →</button>
          </div>
        </footer>
      </section>
    </div>
  )
}
