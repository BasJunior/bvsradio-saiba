'use client'

import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import EditorialWorkDrawer, { type EditorialCommandItem } from '@/components/EditorialWorkDrawer'

type CommandPayload = {
  items: EditorialCommandItem[]
  summary: { total: number; needsAction: number; counts: Record<string, number>; generatedAt: string }
}

function workObjectId(item: EditorialCommandItem) {
  if (item.kind === 'artist_name' || item.kind === 'producer_name') return item.id.split(':')[0] || item.id
  return item.id
}

function sectionForKind(kind: string) {
  if (kind === 'release') return 'ed-releases'
  if (kind === 'beat') return 'ed-beats'
  if (kind === 'track') return 'ed-tracks'
  if (kind === 'request') return 'ed-requests'
  if (kind === 'role') return 'ed-role-applications'
  if (kind === 'artist_name' || kind === 'producer_name') return 'ed-identities'
  if (kind === 'programme' || kind === 'creator') return 'ed-artists'
  if (kind === 'audit') return 'ed-audit'
  return 'ed-overview'
}

function parseWork(value: string | null) {
  if (!value) return null
  const separator = value.indexOf(':')
  if (separator <= 0) return null
  const kind = value.slice(0, separator)
  const id = value.slice(separator + 1)
  return kind && id ? { kind, id } : null
}

export default function EditorialWorkBridge() {
  const pathname = usePathname()
  const active =
    pathname === '/editorial' ||
    pathname === '/admin/editorial' ||
    pathname?.startsWith('/editorial/') ||
    pathname?.startsWith('/admin/editorial/')
  const [payload, setPayload] = useState<CommandPayload | null>(null)
  const [workKey, setWorkKey] = useState('')

  const readLocation = useCallback(() => {
    if (!active || typeof window === 'undefined') return
    setWorkKey(new URL(window.location.href).searchParams.get('work') || '')
  }, [active])

  const loadIndex = useCallback(async (force = false) => {
    if (!active || !isSupabaseConfigured()) return
    if (payload && !force) return
    try {
      const { data } = await createClient().auth.getSession()
      const token = data.session?.access_token
      if (!token) return
      const response = await fetch('/api/admin/editorial/search', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      if (!response.ok) return
      const next = await response.json() as CommandPayload
      setPayload(next)
    } catch {
      // The drawer can still load an exact object from the URL without the index.
    }
  }, [active, payload])

  useEffect(() => {
    if (!active) return
    readLocation()
    void loadIndex()

    const eventName = 'bvs:editorial-location-change'
    const originalPushState = window.history.pushState
    const originalReplaceState = window.history.replaceState
    const notify = () => window.dispatchEvent(new Event(eventName))

    window.history.pushState = function (...args) {
      originalPushState.apply(this, args)
      notify()
    }
    window.history.replaceState = function (...args) {
      originalReplaceState.apply(this, args)
      notify()
    }

    const onLocation = () => readLocation()
    window.addEventListener(eventName, onLocation)
    window.addEventListener('popstate', onLocation)
    window.addEventListener('hashchange', onLocation)
    return () => {
      window.history.pushState = originalPushState
      window.history.replaceState = originalReplaceState
      window.removeEventListener(eventName, onLocation)
      window.removeEventListener('popstate', onLocation)
      window.removeEventListener('hashchange', onLocation)
    }
  }, [active, loadIndex, readLocation])

  const parsed = useMemo(() => parseWork(workKey), [workKey])
  const selected = useMemo<EditorialCommandItem | null>(() => {
    if (!parsed) return null
    const exact = payload?.items.find((item) => item.kind === parsed.kind && workObjectId(item) === parsed.id)
    if (exact) return exact
    return {
      id: parsed.id,
      kind: parsed.kind,
      title: 'Editorial work item',
      subtitle: 'Loading exact object…',
      section: sectionForKind(parsed.kind),
      priority: 0,
      keywords: [],
    }
  }, [parsed, payload])

  const queue = useMemo(() => {
    if (!selected || !payload) return selected ? [selected] : []
    if (selected.priority > 0) {
      const attention = payload.items.filter((item) => item.priority > 0)
      return attention.some((item) => item.kind === selected.kind && item.id === selected.id)
        ? attention
        : [selected, ...attention]
    }
    const sameKind = payload.items.filter((item) => item.kind === selected.kind)
    return sameKind.some((item) => item.id === selected.id) ? sameKind : [selected, ...sameKind]
  }, [payload, selected])

  const writeSelection = (item: EditorialCommandItem | null) => {
    const url = new URL(window.location.href)
    if (item) {
      url.searchParams.set('work', `${item.kind}:${workObjectId(item)}`)
      url.hash = item.section || sectionForKind(item.kind)
    } else {
      url.searchParams.delete('work')
    }
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
  }

  const openFull = (item: EditorialCommandItem) => {
    writeSelection(null)
    const sectionId = item.section || sectionForKind(item.kind)
    const section = document.getElementById(sectionId)
    if (!section) {
      window.location.hash = sectionId
      return
    }
    const toggle = section.querySelector<HTMLButtonElement>(':scope > button[aria-expanded]')
    if (toggle?.getAttribute('aria-expanded') === 'false') toggle.click()
    window.setTimeout(() => {
      const objectId = workObjectId(item)
      const identity = item.kind === 'artist_name' ? 'artist' : item.kind === 'producer_name' ? 'producer' : ''
      const target = identity
        ? section.querySelector<HTMLElement>(`[data-editorial-identity="${identity}"][data-editorial-id="${CSS.escape(objectId)}"]`)
        : section.querySelector<HTMLElement>(`[data-editorial-id="${CSS.escape(objectId)}"]`)
      const destination = target || section
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      destination.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: target ? 'center' : 'start' })
      if (target) {
        const hadTabIndex = target.hasAttribute('tabindex')
        if (!hadTabIndex) target.setAttribute('tabindex', '-1')
        target.focus({ preventScroll: true })
        window.setTimeout(() => { if (!hadTabIndex) target.removeAttribute('tabindex') }, 1400)
      }
    }, toggle ? 100 : 0)
  }

  if (!active || !selected) return null

  return (
    <EditorialWorkDrawer
      command={selected}
      queue={queue}
      onClose={() => writeSelection(null)}
      onSelect={(item) => writeSelection(item)}
      onOpenFull={openFull}
      onMutated={() => loadIndex(true)}
    />
  )
}
