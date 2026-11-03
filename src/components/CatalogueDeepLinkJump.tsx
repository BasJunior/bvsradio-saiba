'use client'

import { useEffect } from 'react'

function currentHashTarget() {
  if (typeof window === 'undefined') return ''
  const raw = window.location.hash.replace(/^#/, '')
  if (!raw) return ''
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

function isBeatStoreRoute(url: URL) {
  return url.pathname === '/catalogue' && url.searchParams.get('type') === 'beat'
}

export default function CatalogueDeepLinkJump() {
  useEffect(() => {
    let observer: MutationObserver | null = null
    let frame = 0
    let timeout = 0
    const topTimers: number[] = []

    const clearTopTimers = () => {
      while (topTimers.length) {
        const timer = topTimers.pop()
        if (timer) window.clearTimeout(timer)
      }
    }

    const stop = () => {
      if (frame) window.cancelAnimationFrame(frame)
      if (timeout) window.clearTimeout(timeout)
      observer?.disconnect()
      observer = null
    }

    const scrollToBeatStoreHeading = () => {
      const heading = Array.from(document.querySelectorAll<HTMLElement>('h1')).find(
        node => node.textContent?.trim().toLowerCase() === 'beatstore',
      )
      if (!heading) {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
        return
      }

      const headerOffset = 80
      const top = Math.max(0, heading.getBoundingClientRect().top + window.scrollY - headerOffset)
      window.scrollTo({ top, left: 0, behavior: 'auto' })
    }

    const forceBeatStoreHeading = () => {
      clearTopTimers()
      scrollToBeatStoreHeading()
      window.requestAnimationFrame(scrollToBeatStoreHeading)
      ;[80, 180, 360, 700].forEach(delay => {
        topTimers.push(window.setTimeout(scrollToBeatStoreHeading, delay))
      })
    }

    const jump = () => {
      stop()
      const targetId = currentHashTarget()
      const params = new URLSearchParams(window.location.search)
      const producer = params.get('producer') || ''
      const pack = params.get('pack') || ''

      if (params.get('type') === 'beat' && !producer && !pack && (!targetId || targetId === 'beatstore')) {
        if (targetId === 'beatstore') {
          window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`)
        }
        forceBeatStoreHeading()
        return
      }

      if (!targetId) return

      const tryJump = () => {
        const target = document.getElementById(targetId)
        if (!target) return false
        target.scrollIntoView({ block: 'start' })
        stop()
        return true
      }

      frame = window.requestAnimationFrame(() => {
        frame = window.requestAnimationFrame(() => {
          if (tryJump()) return
          observer = new MutationObserver(() => void tryJump())
          observer.observe(document.body, { childList: true, subtree: true })
          timeout = window.setTimeout(stop, 2000)
        })
      })
    }

    const onDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!(target instanceof HTMLAnchorElement)) return

      const destination = new URL(target.href, window.location.href)
      if (!isBeatStoreRoute(destination)) return
      if (destination.searchParams.get('producer') || destination.searchParams.get('pack')) return

      const current = new URL(window.location.href)
      if (isBeatStoreRoute(current)) {
        event.preventDefault()
        window.history.replaceState({}, '', `${destination.pathname}${destination.search}`)
        forceBeatStoreHeading()
      }
    }

    jump()
    document.addEventListener('click', onDocumentClick, true)
    window.addEventListener('hashchange', jump)
    window.addEventListener('popstate', jump)
    return () => {
      stop()
      clearTopTimers()
      document.removeEventListener('click', onDocumentClick, true)
      window.removeEventListener('hashchange', jump)
      window.removeEventListener('popstate', jump)
    }
  }, [])

  return null
}
