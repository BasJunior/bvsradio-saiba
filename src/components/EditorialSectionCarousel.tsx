'use client'

import { type ReactNode, useId, useMemo, useState } from 'react'

type EditorialSectionCarouselProps = {
  label: string
  count?: number
  children: ReactNode
  className?: string
  /** Per-card shell. Defaults to full-width stack-friendly cards (no horizontal carousel). */
  itemClassName?: string
  /** Optional free-text Direktzugriff filter for this section only. */
  filterPlaceholder?: string
  filterValue?: string
  onFilterChange?: (value: string) => void
  filterHint?: string
  /** Kept for call-site compatibility; ignored — layout is no longer a sideways scroller. */
  scrollFactor?: number
  minScrollPx?: number
  /**
   * When true, children are already artist-group blocks — render as a single column stack.
   * Default false uses a dense 1→2 column grid of leaf cards.
   */
  artistGrouped?: boolean
}

/**
 * Staff section navigator for editorial queues.
 * Dense filterable list/grid with Direktzugriff — not a horizontal carousel.
 * Filter chrome is NOT position:sticky (that trapped mobile page scroll inside long sections).
 */
export default function EditorialSectionCarousel({
  label,
  count,
  children,
  className = '',
  itemClassName = 'min-w-0 w-full',
  filterPlaceholder,
  filterValue,
  onFilterChange,
  filterHint,
  artistGrouped = false,
}: EditorialSectionCarouselProps) {
  const labelId = useId()
  const filterId = useId()
  const [internalFilter, setInternalFilter] = useState('')
  const controlled = typeof filterValue === 'string' && typeof onFilterChange === 'function'
  const activeFilter = controlled ? filterValue : internalFilter
  const showFilter = Boolean(filterPlaceholder || onFilterChange || filterValue !== undefined)

  const setFilter = (value: string) => {
    if (controlled) onFilterChange?.(value)
    else setInternalFilter(value)
  }

  const childCount = useMemo(() => {
    if (typeof count === 'number') return count
    if (Array.isArray(children)) return children.length
    return children ? 1 : 0
  }, [children, count])

  const items = Array.isArray(children) ? children : children ? [children] : []

  return (
    <div
      className={`relative ${className}`}
      data-editorial-section={label}
      data-editorial-nav={artistGrouped ? 'artist-groups' : 'list'}
    >
      <div className="mb-3 rounded-2xl border border-white/10 bg-bg-primary/80 px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p id={labelId} className="text-xs uppercase tracking-[.18em] text-text-secondary">
            {label}
            {typeof childCount === 'number' ? ` · ${childCount}` : ''}
            {activeFilter.trim() ? ' · filtered' : ''}
          </p>
          {showFilter ? (
            <div className="relative min-w-[14rem] flex-1 sm:max-w-md sm:flex-none">
              <label htmlFor={filterId} className="sr-only">
                Direktzugriff filter for {label}
              </label>
              <input
                id={filterId}
                type="search"
                value={activeFilter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder={filterPlaceholder || 'Direktzugriff…'}
                className="w-full rounded-full border border-white/15 bg-black/30 py-2 pl-3 pr-9 text-xs text-text-primary outline-none placeholder:text-text-secondary/70 focus:border-brand"
                autoComplete="off"
                spellCheck={false}
              />
              {activeFilter ? (
                <button
                  type="button"
                  onClick={() => setFilter('')}
                  className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-text-secondary hover:text-brand"
                  aria-label={`Clear ${label} filter`}
                >
                  ×
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        {showFilter && filterHint ? (
          <p className="mt-1.5 text-[11px] text-text-secondary/80">{filterHint}</p>
        ) : null}
      </div>

      <div
        role="region"
        aria-labelledby={labelId}
        className={artistGrouped ? 'flex flex-col gap-3' : 'grid grid-cols-1 gap-4 xl:grid-cols-2'}
      >
        {items.map((child, index) => (
          <div key={index} className={itemClassName}>
            {child}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Case-insensitive haystack match for section Direktzugriff filters. */
export function matchesEditorialFilter(query: string, ...parts: Array<string | number | null | undefined | boolean>): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  const tokens = needle.split(/\s+/).filter(Boolean)
  const haystack = parts
    .filter((part) => part !== null && part !== undefined && part !== false)
    .map((part) => String(part).toLowerCase())
    .join(' ')
  return tokens.every((token) => haystack.includes(token))
}

export type EditorialArtistGroup<T> = {
  key: string
  label: string
  items: T[]
  latestAt: number
  pendingCount: number
}

const PENDING_STATUSES = new Set([
  'submitted',
  'in_review',
  'pending',
  'changes_requested',
  'information_requested',
  'queued',
  'processing',
])

function isPendingStatus(status?: string | null) {
  if (!status) return false
  return PENDING_STATUSES.has(String(status).toLowerCase())
}

function statusRank(status?: string | null) {
  const s = String(status || '').toLowerCase()
  if (s === 'submitted' || s === 'pending' || s === 'queued') return 0
  if (s === 'in_review' || s === 'processing' || s === 'changes_requested' || s === 'information_requested') return 1
  if (s === 'approved' || s === 'ready') return 2
  if (s === 'published') return 3
  if (s === 'rejected' || s === 'blocked') return 4
  return 5
}

/**
 * Group queue items by artist/producer. Newest upload activity first.
 * Inside a group: pending/review first, then newest release/upload date.
 */
export function groupEditorialByArtist<T>(
  items: T[],
  opts: {
    artistKey: (item: T) => string
    artistLabel: (item: T) => string
    createdAt: (item: T) => string | number | Date | null | undefined
    status?: (item: T) => string | null | undefined
    /** Optional secondary sort inside group (e.g. release position). Lower first after status/date. */
    secondary?: (item: T) => number
  },
): EditorialArtistGroup<T>[] {
  const map = new Map<string, EditorialArtistGroup<T>>()

  for (const item of items) {
    const rawKey = opts.artistKey(item)?.trim() || 'unknown'
    const key = rawKey.toLowerCase()
    const label = opts.artistLabel(item)?.trim() || rawKey || 'Unknown artist'
    const ts = (() => {
      const v = opts.createdAt(item)
      if (v == null || v === '') return 0
      const n = typeof v === 'number' ? v : new Date(v).getTime()
      return Number.isFinite(n) ? n : 0
    })()
    const pending = isPendingStatus(opts.status?.(item))
    const existing = map.get(key)
    if (!existing) {
      map.set(key, {
        key,
        label,
        items: [item],
        latestAt: ts,
        pendingCount: pending ? 1 : 0,
      })
    } else {
      existing.items.push(item)
      existing.latestAt = Math.max(existing.latestAt, ts)
      if (pending) existing.pendingCount += 1
      if (label && label !== 'Unknown artist' && existing.label === 'Unknown artist') existing.label = label
    }
  }

  const groups = Array.from(map.values())
  for (const group of groups) {
    group.items.sort((a, b) => {
      const sa = statusRank(opts.status?.(a))
      const sb = statusRank(opts.status?.(b))
      if (sa !== sb) return sa - sb
      const ta = (() => {
        const v = opts.createdAt(a)
        if (v == null || v === '') return 0
        const n = typeof v === 'number' ? v : new Date(v).getTime()
        return Number.isFinite(n) ? n : 0
      })()
      const tb = (() => {
        const v = opts.createdAt(b)
        if (v == null || v === '') return 0
        const n = typeof v === 'number' ? v : new Date(v).getTime()
        return Number.isFinite(n) ? n : 0
      })()
      if (tb !== ta) return tb - ta
      const secA = opts.secondary?.(a) ?? 0
      const secB = opts.secondary?.(b) ?? 0
      return secA - secB
    })
  }

  groups.sort((a, b) => {
    if (b.latestAt !== a.latestAt) return b.latestAt - a.latestAt
    if (b.pendingCount !== a.pendingCount) return b.pendingCount - a.pendingCount
    return a.label.localeCompare(b.label)
  })

  return groups
}

/** Collapsible artist folder for nested submissions. */
export function EditorialArtistGroupCard({
  label,
  count,
  pendingCount,
  latestAt,
  defaultOpen = false,
  forceOpen = false,
  children,
}: {
  label: string
  count: number
  pendingCount?: number
  latestAt?: number
  defaultOpen?: boolean
  /** When filtering, keep groups open so matches are visible. */
  forceOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const expanded = forceOpen || open
  const latestLabel =
    latestAt && latestAt > 0
      ? new Date(latestAt).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : null

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[.02]">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/[.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <span className="min-w-0">
          <span className="block truncate font-semibold text-text-primary">{label}</span>
          <span className="mt-0.5 block text-[11px] text-text-secondary">
            {count} {count === 1 ? 'item' : 'items'}
            {pendingCount ? ` · ${pendingCount} needs review` : ''}
            {latestLabel ? ` · latest ${latestLabel}` : ''}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs text-text-secondary">
          {expanded ? 'Hide' : 'Open'}
          <svg
            viewBox="0 0 20 20"
            aria-hidden="true"
            className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {expanded ? <div className="space-y-3 border-t border-white/10 px-3 pb-3 pt-3 sm:px-4">{children}</div> : null}
    </div>
  )
}
