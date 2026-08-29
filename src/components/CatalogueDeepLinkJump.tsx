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

export default function CatalogueDeepLinkJump() {
  useEffect(() => {
    let observer: MutationObserver | null = null
    let frame = 0
    let timeout = 0

    const stop = () => {
      if (frame) window.cancelAnimationFrame(frame)
      if (timeout) window.clearTimeout(timeout)
      observer?.disconnect()
      observer = null
    }

    const jump = () => {
      stop()
      const targetId = currentHashTarget()
      if (!targetId) return

      const tryJump = () => {
        const target = document.getElementById(targetId)
        if (!target) return false
        target.scrollIntoView({ block: 'start' })
        stop()
        return true
      }

      // Catalogue filters are derived from the query string. Give React one paint
      // to render the matching BeatStore/browse section before resolving the hash.
      frame = window.requestAnimationFrame(() => {
        frame = window.requestAnimationFrame(() => {
          if (tryJump()) return
          observer = new MutationObserver(() => void tryJump())
          observer.observe(document.body, { childList: true, subtree: true })
          timeout = window.setTimeout(stop, 2000)
        })
      })
    }

    jump()
    window.addEventListener('hashchange', jump)
    window.addEventListener('popstate', jump)
    return () => {
      stop()
      window.removeEventListener('hashchange', jump)
      window.removeEventListener('popstate', jump)
    }
  }, [])

  return null
}
