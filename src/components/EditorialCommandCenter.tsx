'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import EditorialWorkDrawer, { type EditorialCommandItem } from '@/components/EditorialWorkDrawer'

type CommandKind = 'release' | 'track' | 'beat' | 'creator' | 'artist_name' | 'producer_name' | 'request' | 'role' | 'programme' | 'audit'
type CommandFilter = 'attention' | 'all' | CommandKind
type CommandItem = EditorialCommandItem & { kind: CommandKind }

type CommandPayload = {
  items: CommandItem[]
  summary: {
    total: number
    needsAction: number
    counts: Record<string, number>
    generatedAt: string
  }
}

const filters: Array<{ value: CommandFilter; label: string }> = [
  { value: 'attention', label: 'Needs action' },
  { value: 'all', label: 'All' },
  { value: 'release', label: 'Releases' },
  { value: 'track', label: 'Tracks' },
  { value: 'beat', label: 'Beats' },
  { value: 'creator', label: 'Creators' },
  { value: 'artist_name', label: 'Artist names' },
  { value: 'producer_name', label: 'Producer names' },
  { value: 'request', label: 'Requests' },
  { value: 'role', label: 'Roles' },
  { value: 'programme', label: 'Programmes' },
  { value: 'audit', label: 'Audit' },
]

function normalize(value?: string | null) {
  return (value || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim()
}

function kindLabel(kind: CommandKind) {
  if (kind === 'role') return 'Role application'
  if (kind === 'artist_name') return 'Artist identity'
  if (kind === 'producer_name') return 'Producer identity'
  return kind.charAt(0).toUpperCase() + kind.slice(1)
}

function workObjectId(item: CommandItem) {
  if (item.kind === 'artist_name' || item.kind === 'producer_name') return item.id.split(':')[0] || item.id
  return item.id
}

function isEditable(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest('input,textarea,select,[contenteditable="true"]'))
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
  if (days < 30) return `${days}d ago`
  return new Date(time).toLocaleDateString()
}

function resultScore(item: CommandItem, query: string) {
  const q = normalize(query)
  if (!q) return item.priority * 20 + (Date.parse(item.createdAt || '') || 0) / 1e12
  const title = normalize(item.title)
  const subtitle = normalize(item.subtitle)
  const status = normalize(item.status)
  const keywords = normalize(item.keywords.join(' '))
  if (title === q) return 5000 + item.priority
  if (title.startsWith(q)) return 4200 + item.priority
  if (title.includes(q)) return 3600 + item.priority
  if (subtitle.includes(q)) return 2600 + item.priority
  if (status.includes(q)) return 2200 + item.priority
  const tokens = q.split(' ').filter((token) => token.length >= 2)
  const haystack = `${title} ${subtitle} ${status} ${keywords}`
  const hits = tokens.filter((token) => haystack.includes(token)).length
  return hits ? hits * 500 + item.priority : 0
}

function findTarget(section: HTMLElement, item: CommandItem) {
  const objectId = workObjectId(item)
  const byAttr =
    section.querySelector<HTMLElement>(`[data-editorial-id="${CSS.escape(objectId)}"]`) ||
    section.querySelector<HTMLElement>(`[data-editorial-id="${CSS.escape(item.id)}"]`) ||
    (item.kind === 'artist_name'
      ? section.querySelector<HTMLElement>(`[data-editorial-identity="artist"][data-editorial-id="${CSS.escape(objectId)}"]`)
      : null) ||
    (item.kind === 'producer_name'
      ? section.querySelector<HTMLElement>(`[data-editorial-identity="producer"][data-editorial-id="${CSS.escape(objectId)}"]`)
      : null)
  if (byAttr) return byAttr

  const title = normalize(item.title)
  const candidates = Array.from(section.querySelectorAll<HTMLElement>('article, tr, li, [role="group"]'))
  return candidates.find((element) => normalize(element.textContent).includes(title)) || null
}

function writeWorkUrl(item: CommandItem | null) {
  try {
    const url = new URL(window.location.href)
    if (item) url.searchParams.set('work', `${item.kind}:${workObjectId(item)}`)
    else url.searchParams.delete('work')
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
  } catch {
    // URL state is convenience; never block editorial work.
  }
}

function openFullPanel(item: CommandItem) {
  const section = document.getElementById(item.section)
  try {
    const url = new URL(window.location.href)
    url.searchParams.delete('work')
    url.hash = item.section
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
  } catch {
    window.location.hash = item.section
  }
  if (!section) return

  const toggle = section.querySelector<HTMLButtonElement>(':scope > button[aria-expanded]')
  if (toggle?.getAttribute('aria-expanded') === 'false') toggle.click()
  window.setTimeout(() => {
    const latest = document.getElementById(item.section)
    if (!latest) return
    const target = findTarget(latest, item) || latest
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: target === latest ? 'start' : 'center' })
    if (target !== latest) {
      const hadTabIndex = target.hasAttribute('tabindex')
      if (!hadTabIndex) target.setAttribute('tabindex', '-1')
      target.focus({ preventScroll: true })
      const outline = target.style.outline
      const offset = target.style.outlineOffset
      target.style.outline = '2px solid var(--color-brand, #d7ff4f)'
      target.style.outlineOffset = '6px'
      window.setTimeout(() => {
        target.style.outline = outline
        target.style.outlineOffset = offset
        if (!hadTabIndex) target.removeAttribute('tabindex')
      }, 2200)
    }
  }, toggle ? 90 : 0)
}

function saveRecent(item: CommandItem) {
  try {
    const key = 'bvs.editorial.command.recent.v1'
    const current = JSON.parse(window.sessionStorage.getItem(key) || '[]') as CommandItem[]
    const next = [item, ...current.filter((entry) => !(entry.id === item.id && entry.kind === item.kind))].slice(0, 6)
    window.sessionStorage.setItem(key, JSON.stringify(next))
  } catch {
    // Session-only convenience.
  }
}

export default function EditorialCommandCenter() {
  const pathname = usePathname()
  const active =
    pathname === '/editorial' ||
    pathname === '/admin/editorial' ||
    pathname?.startsWith('/editorial/') ||
    pathname?.startsWith('/admin/editorial/')
  const [payload, setPayload] = useState<CommandPayload | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<CommandFilter>('attention')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [selectedWork, setSelectedWork] = useState<CommandItem | null>(null)
  const [workQueue, setWorkQueue] = useState<CommandItem[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const launcherRef = useRef<HTMLButtonElement>(null)
  const requestRef = useRef<Promise<void> | null>(null)

  const loadIndex = async (force = false) => {
    if (!active || !isSupabaseConfigured()) return
    if (requestRef.current && !force) return requestRef.current
    if (payload && !force) return
    const task = (async () => {
      setLoading(true)
      setError('')
      try {
        const supabase = createClient()
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        if (!token) throw new Error('Sign in to use Editorial Command.')
        const response = await fetch('/api/admin/editorial/search', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        const body = await response.json() as CommandPayload & { error?: string }
        if (!response.ok) throw new Error(body.error || 'Editorial search is unavailable.')
        setPayload(body)
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Editorial search is unavailable.')
      } finally {
        setLoading(false)
        requestRef.current = null
      }
    })()
    requestRef.current = task
    return task
  }

  useEffect(() => {
    if (!active) return
    const warm = window.setTimeout(() => void loadIndex(), 500)
    return () => window.clearTimeout(warm)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  useEffect(() => {
    if (!active || !payload || selectedWork) return
    try {
      const raw = new URL(window.location.href).searchParams.get('work')
      if (!raw) return
      const separator = raw.indexOf(':')
      if (separator < 1) return
      const kind = raw.slice(0, separator)
      const id = raw.slice(separator + 1)
      const item = payload.items.find((candidate) => candidate.kind === kind && workObjectId(candidate) === id)
      if (!item) return
      setSelectedWork(item)
      setWorkQueue(item.priority > 0 ? payload.items.filter((candidate) => candidate.priority > 0) : payload.items)
    } catch {
      // Ignore malformed deep-link state.
    }
  }, [active, payload, selectedWork])

  useEffect(() => {
    if (!active) return
    const onKeyDown = (event: KeyboardEvent) => {
      const commandK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k'
      const slash = event.key === '/' && !isEditable(event.target)
      if (commandK || slash) {
        event.preventDefault()
        setOpen(true)
        void loadIndex()
        window.setTimeout(() => inputRef.current?.focus(), 0)
      }
      if (event.key === 'Escape' && open) setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, open, payload])

  const results = useMemo(() => {
    const items = payload?.items || []
    const filtered = items.filter((item) => {
      if (filter === 'attention') return item.priority > 0
      if (filter === 'all') return true
      return item.kind === filter
    })
    return filtered
      .map((item) => ({ item, score: resultScore(item, query) }))
      .filter((entry) => entry.score > 0 || !query.trim())
      .sort((a, b) => b.score - a.score)
      .slice(0, 24)
      .map((entry) => entry.item)
  }, [filter, payload, query])

  useEffect(() => {
    setActiveIndex(0)
  }, [filter, query])

  if (!active) return null

  const openResult = (item: CommandItem) => {
    saveRecent(item)
    const snapshot = results.length ? results : (payload?.items || [])
    setWorkQueue(snapshot)
    setSelectedWork(item)
    setOpen(false)
    setQuery('')
    writeWorkUrl(item)
  }

  const closeWork = () => {
    setSelectedWork(null)
    writeWorkUrl(null)
    window.setTimeout(() => launcherRef.current?.focus(), 0)
  }

  const selectWork = (item: EditorialCommandItem) => {
    const nextItem = item as CommandItem
    setSelectedWork(nextItem)
    writeWorkUrl(nextItem)
  }

  const openFull = (item: EditorialCommandItem) => {
    const nextItem = item as CommandItem
    setSelectedWork(null)
    writeWorkUrl(null)
    window.setTimeout(() => openFullPanel(nextItem), 0)
  }

  const nextAction = results.find((item) => item.priority > 0) || payload?.items.find((item) => item.priority > 0)

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((value) => Math.min(results.length - 1, value + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((value) => Math.max(0, value - 1))
    } else if (event.key === 'Enter' && results[activeIndex]) {
      event.preventDefault()
      openResult(results[activeIndex])
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-6 pt-5">
      <div className="rounded-2xl border border-brand/20 bg-brand/[.035] p-3 shadow-lg shadow-black/10">
        <div className="flex flex-wrap items-center gap-3">
          <button
            ref={launcherRef}
            type="button"
            onClick={() => {
              setOpen(true)
              void loadIndex()
              window.setTimeout(() => inputRef.current?.focus(), 0)
            }}
            className="flex min-h-12 min-w-0 flex-1 items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 text-left transition hover:border-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            aria-haspopup="dialog"
          >
            <span className="min-w-0">
              <span className="block text-xs font-semibold uppercase tracking-[.18em] text-brand">Editorial Command</span>
              <span className="block truncate text-sm text-text-secondary">Search and open the exact track, release, beat, creator, request or programme.</span>
            </span>
            <span className="shrink-0 rounded-lg border border-white/10 px-2 py-1 text-xs text-text-secondary">⌘K / Ctrl K</span>
          </button>

          {payload ? (
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-amber-300/25 bg-amber-300/[.06] px-3 py-2 text-xs text-amber-200">
                {payload.summary.needsAction} need action
              </span>
              {nextAction ? (
                <button type="button" onClick={() => openResult(nextAction)} className="min-h-11 rounded-full bg-brand px-4 py-2 text-xs font-semibold text-black">
                  Review next →
                </button>
              ) : null}
            </div>
          ) : loading ? <span className="text-xs text-text-secondary">Indexing…</span> : null}
        </div>
        <p className="mt-2 px-1 text-[11px] text-text-secondary">Tip: press <strong className="text-text-primary">/</strong> outside a form. Results open as exact work objects; quick actions still use the existing audited editorial API.</p>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[120] flex items-start justify-center bg-black/75 px-3 pt-[max(5rem,env(safe-area-inset-top))] backdrop-blur-sm sm:px-6 sm:pt-24"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="editorial-command-title" className="flex max-h-[min(78vh,760px)] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-bg-primary shadow-2xl">
            <div className="border-b border-white/10 p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p id="editorial-command-title" className="text-xs font-semibold uppercase tracking-[.2em] text-brand">Editorial Command Center</p>
                  <p className="mt-1 text-sm text-text-secondary">Find the work object, not the accordion it lives in.</p>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="grid h-11 w-11 place-items-center rounded-full border border-white/10 text-xl text-text-secondary hover:border-brand hover:text-white" aria-label="Close Editorial Command">×</button>
              </div>
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Try ‘Wolf’, ‘submitted’, a track title, username, programme or ID…"
                className="mt-4 w-full rounded-2xl border border-white/15 bg-black/25 px-5 py-4 text-lg outline-none placeholder:text-text-secondary focus:border-brand"
                aria-label="Search editorial workflow"
              />
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Editorial command filters">
                {filters.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setFilter(item.value)}
                    aria-pressed={filter === item.value}
                    className={`min-h-10 shrink-0 rounded-full px-3 py-2 text-xs ${filter === item.value ? 'bg-brand text-black' : 'border border-white/10 text-text-secondary hover:text-white'}`}
                  >
                    {item.label}{item.value === 'attention' && payload ? ` ${payload.summary.needsAction}` : ''}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 sm:p-4">
              {loading && !payload ? <p className="p-6 text-center text-sm text-text-secondary">Building the staff index…</p> : null}
              {error ? <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-200"><p>{error}</p><button type="button" onClick={() => void loadIndex(true)} className="mt-3 rounded-full border border-red-300/30 px-3 py-1.5 text-xs">Retry</button></div> : null}
              {!loading && payload && !results.length ? <p className="p-8 text-center text-sm text-text-secondary">No editorial item matches this search and filter.</p> : null}
              <div className="space-y-2">
                {results.map((item, index) => (
                  <button
                    key={`${item.kind}:${item.id}:${item.section}`}
                    type="button"
                    onClick={() => openResult(item)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition ${activeIndex === index ? 'border-brand/50 bg-brand/[.055]' : 'border-white/10 bg-white/[.02] hover:border-white/20'}`}
                  >
                    <span className="mt-0.5 rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-brand">{kindLabel(item.kind)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{item.title}</span>
                      <span className="mt-1 block line-clamp-2 text-xs text-text-secondary">{item.subtitle}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      {item.status ? <span className={`block text-[10px] uppercase tracking-wider ${item.priority ? 'text-amber-200' : 'text-text-secondary'}`}>{item.status.replaceAll('_', ' ')}</span> : null}
                      {item.createdAt ? <span className="mt-1 block text-[10px] text-text-secondary">{ageLabel(item.createdAt)}</span> : null}
                      <span className="mt-2 block text-xs text-brand">Work →</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-4 py-3 text-[11px] text-text-secondary">
              <span>↑↓ move · Enter open · Esc close</span>
              {payload ? <button type="button" onClick={() => void loadIndex(true)} className="rounded-full border border-white/10 px-3 py-1.5 hover:border-brand hover:text-white">Refresh index</button> : null}
            </footer>
          </section>
        </div>
      ) : null}

      {selectedWork ? (
        <EditorialWorkDrawer
          command={selectedWork}
          queue={workQueue.length ? workQueue : [selectedWork]}
          onClose={closeWork}
          onSelect={selectWork}
          onOpenFull={openFull}
          onMutated={() => loadIndex(true)}
        />
      ) : null}
    </div>
  )
}
