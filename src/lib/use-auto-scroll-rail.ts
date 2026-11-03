'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'

/** Slow looping artwork rails. Manual interaction and offscreen rails stay still. */
export function useAutoScrollRail(ref: RefObject<HTMLDivElement | null>, count: number) {
  const [paused, setPaused] = useState(false)
  const manualUntil = useRef(0)
  useEffect(() => {
    const node = ref.current
    if (!node || count < 2) return
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let hovered = false, focused = false, touching = false, visible = false, frame = 0, last = 0, position = node.scrollLeft
    const enter = () => { hovered = true }
    const leave = () => { hovered = false }
    const focus = () => { focused = true }
    const blur = (event: FocusEvent) => { focused = node.contains(event.relatedTarget as Node | null) }
    const manual = () => { manualUntil.current = performance.now() + 4000; position = node.scrollLeft }
    const touch = () => { touching = true; manual() }
    const release = () => { touching = false; manual() }
    const observer = new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting) })
    observer.observe(node)
    node.addEventListener('pointerenter', enter)
    node.addEventListener('pointerleave', leave)
    node.addEventListener('focusin', focus)
    node.addEventListener('focusout', blur)
    node.addEventListener('wheel', manual, { passive: true })
    node.addEventListener('pointerdown', manual)
    node.addEventListener('touchstart', touch, { passive: true })
    node.addEventListener('touchend', release)
    node.addEventListener('touchcancel', release)
    const tick = (now: number) => {
      const elapsed = last ? Math.min(now - last, 48) : 0
      last = now
      const first = node.children.item(0) as HTMLElement | null
      const repeated = node.children.item(count) as HTMLElement | null
      const cycle = first && repeated ? repeated.offsetLeft - first.offsetLeft : 0
      if (!paused && visible && !document.hidden && !motion.matches && !hovered && !focused && !touching && now >= manualUntil.current && cycle > 0) {
        position = (position + elapsed * .018) % cycle
        node.scrollLeft = position
      } else position = node.scrollLeft
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame); observer.disconnect()
      node.removeEventListener('pointerenter', enter); node.removeEventListener('pointerleave', leave)
      node.removeEventListener('focusin', focus); node.removeEventListener('focusout', blur)
      node.removeEventListener('wheel', manual); node.removeEventListener('pointerdown', manual)
      node.removeEventListener('touchstart', touch); node.removeEventListener('touchend', release); node.removeEventListener('touchcancel', release)
    }
  }, [ref, count, paused])
  return { paused, toggle: () => setPaused(value => !value), pauseForInteraction: () => { manualUntil.current = performance.now() + 4000 } }
}
