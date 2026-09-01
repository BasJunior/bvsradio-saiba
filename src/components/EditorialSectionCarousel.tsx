'use client'

import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react'

type EditorialSectionCarouselProps = {
  label: string
  count?: number
  children: ReactNode
  className?: string
  itemClassName?: string
  /** Optional free-text Direktzugriff filter for this section only. */
  filterPlaceholder?: string
  filterValue?: string
  onFilterChange?: (value: string) => void
  filterHint?: string
  /** Scroll step multiplier relative to viewport width. Higher = faster jump. */
  scrollFactor?: number
  /** Pixel minimum step for arrow buttons. */
  minScrollPx?: number
}

/**
 * Horizontal staff carousel for long editorial queues.
 * Keeps full card content usable while avoiding endless vertical scroll.
 * Optional per-section Direktzugriff filter for artist/producer/title jumps.
 */
export default function EditorialSectionCarousel({
  label,
  count,
  children,
  className = '',
  itemClassName = 'min-w-[min(100%,22rem)] max-w-[28rem] shrink-0 snap-start sm:min-w-[24rem]',
  filterPlaceholder,
  filterValue,
  onFilterChange,
  filterHint,
  scrollFactor = 1.15,
  minScrollPx = 360,
}: EditorialSectionCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const labelId = useId()
  const filterId = useId()
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)
  const [internalFilter, setInternalFilter] = useState('')
  const controlled = typeof filterValue === 'string' && typeof onFilterChange === 'function'
  const activeFilter = controlled ? filterValue : internalFilter
  const showFilter = Boolean(filterPlaceholder || onFilterChange || filterValue !== undefined)

  const updateEdges = () => {
    const node = scrollerRef.current
    if (!node) return
    const max = node.scrollWidth - node.clientWidth
    setCanPrev(node.scrollLeft > 8)
    setCanNext(max - node.scrollLeft > 8)
  }

  useEffect(() => {
    const node = scrollerRef.current
    if (!node) return
    updateEdges()
    const onScroll = () => updateEdges()
    node.addEventListener('scroll', onScroll, { passive: true })
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateEdges) : null
    observer?.observe(node)
    window.addEventListener('resize', updateEdges)
    return () => {
      node.removeEventListener('scroll', onScroll)
      observer?.disconnect()
      window.removeEventListener('resize', updateEdges)
    }
  }, [children, activeFilter])

  // When filter changes, jump to start so the first match is visible immediately.
  useEffect(() => {
    const node = scrollerRef.current
    if (!node) return
    node.scrollTo({ left: 0, behavior: 'auto' })
    updateEdges()
  }, [activeFilter])

  const scrollByPage = (direction: -1 | 1) => {
    const node = scrollerRef.current
    if (!node) return
    // Faster staff paging: ~full viewport + a bit, with a higher floor.
    const amount = Math.max(minScrollPx, Math.floor(node.clientWidth * scrollFactor))
    node.scrollBy({ left: direction * amount, behavior: 'smooth' })
  }

  const setFilter = (value: string) => {
    if (controlled) onFilterChange?.(value)
    else setInternalFilter(value)
  }

  const childCount = useMemo(() => {
    if (typeof count === 'number') return count
    if (Array.isArray(children)) return children.length
    return children ? 1 : 0
  }, [children, count])

  return (
    <div className={`relative ${className}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p id={labelId} className="text-xs uppercase tracking-[.18em] text-text-secondary">
          {label}
          {typeof childCount === 'number' ? ` · ${childCount}` : ''}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {showFilter ? (
            <label htmlFor={filterId} className="sr-only">
              Direktzugriff filter for {label}
            </label>
          ) : null}
          {showFilter ? (
            <div className="relative min-w-[12rem] flex-1 sm:min-w-[16rem] sm:flex-none">
              <input
                id={filterId}
                type="search"
                value={activeFilter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder={filterPlaceholder || 'Direktzugriff…'}
                className="w-full rounded-full border border-white/15 bg-black/25 py-2 pl-3 pr-9 text-xs text-text-primary outline-none placeholder:text-text-secondary/70 focus:border-brand"
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
          <button
            type="button"
            onClick={() => scrollByPage(-1)}
            disabled={!canPrev}
            className="grid h-9 w-9 place-items-center rounded-full border border-white/15 text-sm text-text-secondary transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-35"
            aria-label={`Previous ${label}`}
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => scrollByPage(1)}
            disabled={!canNext}
            className="grid h-9 w-9 place-items-center rounded-full border border-white/15 text-sm text-text-secondary transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-35"
            aria-label={`Next ${label}`}
          >
            ›
          </button>
        </div>
      </div>
      {showFilter && filterHint ? (
        <p className="mb-2 text-[11px] text-text-secondary/80">{filterHint}</p>
      ) : null}
      <div
        ref={scrollerRef}
        role="region"
        aria-labelledby={labelId}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 scroll-smooth [-ms-overflow-style:none] [scrollbar-width:thin]"
        data-editorial-carousel={label}
        data-carousel-speed="fast"
      >
        {Array.isArray(children)
          ? children.map((child, index) => (
              <div key={index} className={itemClassName}>
                {child}
              </div>
            ))
          : (
            <div className={itemClassName}>{children}</div>
          )}
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
