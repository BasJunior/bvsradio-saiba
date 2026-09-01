'use client'

import { type ReactNode, useEffect, useId, useRef, useState } from 'react'

type EditorialSectionCarouselProps = {
  label: string
  count?: number
  children: ReactNode
  className?: string
  itemClassName?: string
}

/**
 * Horizontal staff carousel for long editorial queues.
 * Keeps full card content usable while avoiding endless vertical scroll.
 */
export default function EditorialSectionCarousel({
  label,
  count,
  children,
  className = '',
  itemClassName = 'min-w-[min(100%,22rem)] max-w-[28rem] shrink-0 snap-start sm:min-w-[24rem]',
}: EditorialSectionCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const labelId = useId()
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)

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
  }, [children])

  const scrollByPage = (direction: -1 | 1) => {
    const node = scrollerRef.current
    if (!node) return
    const amount = Math.max(240, Math.floor(node.clientWidth * 0.85))
    node.scrollBy({ left: direction * amount, behavior: 'smooth' })
  }

  return (
    <div className={`relative ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p id={labelId} className="text-xs uppercase tracking-[.18em] text-text-secondary">
          {label}
          {typeof count === 'number' ? ` · ${count}` : ''}
        </p>
        <div className="flex items-center gap-2">
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
      <div
        ref={scrollerRef}
        role="region"
        aria-labelledby={labelId}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [-ms-overflow-style:none] [scrollbar-width:thin]"
        data-editorial-carousel={label}
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
