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
}

/**
 * Staff section navigator for editorial queues.
 * Dense filterable list/grid with sticky Direktzugriff — not a horizontal carousel.
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
    <div className={`relative ${className}`} data-editorial-section={label} data-editorial-nav="list">
      <div className="sticky top-16 z-20 -mx-1 mb-3 rounded-2xl border border-white/10 bg-bg-primary/95 px-3 py-2.5 backdrop-blur-xl sm:top-20">
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
        className="grid grid-cols-1 gap-4 xl:grid-cols-2"
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
