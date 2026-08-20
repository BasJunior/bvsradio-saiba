'use client'

import { useEffect, useState } from 'react'
import ExploreItemDetails, { type ExploreDetail } from '@/components/ExploreItemDetails'
import { curatedCatalogueTracks } from '@/lib/catalogue-curated-tracks'

type CatalogueListing = {
  id: string
  title: string
  artist?: string
  genre?: string
  collection?: string
  duration?: string
  description?: string
  src?: string
  artwork?: string
  bpm?: string
  price?: number | null
  externalUrl?: string
  streamOnly?: boolean
  albumPackage?: boolean
  releaseId?: string | null
}

type BeatListing = {
  id: string
  title: string
  producer?: string
  producer_username?: string
  description?: string
  genre?: string
  mood?: string
  bpm?: number
  musical_key?: string
  artworkUrl?: string
  previewUrl?: string
  startingPrice?: number
}

type ReleaseListing = {
  id: string
  title: string
  artist?: string
  genre?: string
  description?: string
  cover?: string
  releaseType?: string
  copyrightYear?: number
  publishedAt?: string
  tracks?: Array<{
    id: string
    title: string
    position?: number
    src?: string
    credits?: Array<{ person_name: string; credit_role: string }>
  }>
}

const detailKinds = new Set(['track', 'beat', 'release'])
const interactiveSelector = 'a[href],button,input,select,textarea,[role="button"],[contenteditable="true"]'

function normalise(value?: string | null) {
  return (value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function relativeHref(value?: string | null) {
  if (!value) return ''
  try {
    const url = new URL(value, window.location.origin)
    if (url.origin !== window.location.origin) return value
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return value
  }
}

function kindFromSearchArticle(target: HTMLElement) {
  const article = target.closest('article')
  if (!article) return null
  const labels = Array.from(article.querySelectorAll('span'))
    .map(node => normalise(node.textContent))
  return labels.find(label => detailKinds.has(label)) || null
}

function curatedFor(title: string) {
  const key = normalise(title)
  if (!key) return null
  return curatedCatalogueTracks.find(item => normalise(item.title) === key) || null
}

function baseFromCurated(
  kind: ExploreDetail['kind'],
  title: string,
  href: string,
): ExploreDetail | null {
  const item = curatedFor(title)
  if (!item) return null
  return {
    id: String(item.id),
    kind,
    title: item.title,
    artist: item.artist,
    image: item.artwork,
    genre: item.genre,
    collection: item.collection,
    duration: item.duration,
    description: item.description,
    bpm: item.bpm,
    price: item.price,
    streamOnly: item.streamOnly,
    src: item.src,
    externalUrl: item.externalUrl,
    href,
    actionHref: href,
    albumPackage: item.albumPackage,
    releaseType: kind === 'release' ? (item.albumPackage ? 'album' : 'release') : undefined,
  }
}

function baseFromTrigger(trigger: HTMLElement, kind: ExploreDetail['kind'], href: string): ExploreDetail {
  return {
    id: trigger.dataset.flowDetailId || trigger.dataset.flowDetailTitle || href,
    kind,
    title: trigger.dataset.flowDetailTitle || 'BVS item',
    artist: trigger.dataset.flowDetailArtist || 'BVS creator',
    image: trigger.dataset.flowDetailImage || undefined,
    collection: trigger.dataset.flowDetailCollection || undefined,
    href,
    actionHref: href,
    src: trigger.dataset.flowDetailSrc || undefined,
  }
}

function articleFallback(target: HTMLElement) {
  const article = target.closest<HTMLElement>('article[data-flow-focus-id]')
  if (!article) return null
  const focusId = article.dataset.flowFocusId || ''
  const [kind, id] = focusId.split(':', 2)
  if (kind !== 'track' && kind !== 'beat') return null
  if (target.closest(interactiveSelector)) return null
  const title = article.querySelector('h3')?.textContent?.trim() || ''
  if (!title) return null
  const image = article.querySelector('img')?.getAttribute('src') || undefined
  const artist = document.querySelector('h1')?.textContent?.trim() || 'BVS creator'
  const href = kind === 'beat'
    ? `/catalogue?type=beat&q=${encodeURIComponent(title)}#browse`
    : `/catalogue?q=${encodeURIComponent(title)}`
  return {
    kind: kind as ExploreDetail['kind'],
    id: id || title,
    title,
    artist,
    image,
    href,
  }
}

function libraryFallback(target: HTMLElement, anchor: HTMLAnchorElement | null) {
  if (window.location.pathname !== '/library' || !anchor) return null
  const row = anchor.parentElement
  if (!row?.classList.contains('rounded-xl') || !row.classList.contains('p-4')) return null
  const activeTab = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(button => {
    const label = button.textContent?.trim()
    return (label === 'Saved' || label === 'Following' || label === 'History') && button.className.includes('bg-brand')
  })
  if (activeTab?.textContent?.trim() === 'Following') return null
  const title = row.querySelector('h2')?.textContent?.trim() || ''
  const artist = row.querySelector('p')?.textContent?.trim() || 'BVS creator'
  if (!title) return null
  return {
    kind: 'track' as const,
    id: title,
    title,
    artist,
    href: `/catalogue?q=${encodeURIComponent(title)}`,
  }
}

async function enrich(detail: ExploreDetail) {
  if (detail.kind === 'beat') {
    const response = await fetch('/api/beats', { cache: 'no-store' }).catch(() => null)
    if (!response?.ok) return detail
    const payload = await response.json().catch(() => ({})) as { beats?: BeatListing[] }
    const row = (payload.beats || []).find(item =>
      item.id === detail.id || normalise(item.title) === normalise(detail.title),
    )
    if (!row) return detail
    return {
      ...detail,
      id: row.id,
      title: row.title,
      artist: row.producer || detail.artist,
      image: row.artworkUrl || detail.image,
      genre: row.genre || detail.genre,
      collection: 'BVS BeatStore',
      duration: row.bpm ? `${row.bpm} BPM` : detail.duration,
      description: row.description || detail.description,
      bpm: row.bpm ? String(row.bpm) : detail.bpm,
      mood: row.mood || detail.mood,
      musicalKey: row.musical_key || detail.musicalKey,
      price: row.startingPrice ?? detail.price,
      streamOnly: false,
      src: row.previewUrl || detail.src,
      producerUsername: row.producer_username || detail.producerUsername,
      actionHref: `/catalogue?type=beat${row.producer_username ? `&producer=${encodeURIComponent(row.producer_username)}` : ''}&q=${encodeURIComponent(row.title)}#browse`,
    } satisfies ExploreDetail
  }

  if (detail.kind === 'track') {
    const response = await fetch('/api/catalogue/listings', { cache: 'no-store' }).catch(() => null)
    if (!response?.ok) return detail
    const payload = await response.json().catch(() => ({})) as { listings?: CatalogueListing[] }
    const row = (payload.listings || []).find(item =>
      item.id === detail.id || normalise(item.title) === normalise(detail.title),
    )
    if (!row) return detail
    return {
      ...detail,
      id: row.id,
      title: row.title,
      artist: row.artist || detail.artist,
      image: row.artwork || detail.image,
      genre: row.genre || detail.genre,
      collection: row.collection || detail.collection,
      duration: row.duration || detail.duration,
      description: row.description || detail.description,
      bpm: row.bpm || detail.bpm,
      price: row.price,
      streamOnly: row.streamOnly,
      src: row.src || detail.src,
      externalUrl: row.externalUrl || detail.externalUrl,
      albumPackage: row.albumPackage,
      actionHref: `/catalogue?q=${encodeURIComponent(row.title)}`,
    } satisfies ExploreDetail
  }

  const [releaseResponse, catalogueResponse] = await Promise.all([
    fetch('/api/releases/public', { cache: 'no-store' }).catch(() => null),
    fetch('/api/catalogue/listings', { cache: 'no-store' }).catch(() => null),
  ])
  const releasePayload = releaseResponse?.ok
    ? await releaseResponse.json().catch(() => ({})) as { releases?: ReleaseListing[] }
    : { releases: [] as ReleaseListing[] }
  const cataloguePayload = catalogueResponse?.ok
    ? await catalogueResponse.json().catch(() => ({})) as { listings?: CatalogueListing[] }
    : { listings: [] as CatalogueListing[] }
  const release = (releasePayload.releases || []).find(item =>
    item.id === detail.id || normalise(item.title) === normalise(detail.title),
  )
  const packageRow = (cataloguePayload.listings || []).find(item =>
    (release && item.releaseId === release.id) || normalise(item.title) === normalise(release?.title || detail.title),
  )
  if (!release && !packageRow) return detail

  return {
    ...detail,
    id: release?.id || packageRow?.id || detail.id,
    title: release?.title || packageRow?.title || detail.title,
    artist: release?.artist || packageRow?.artist || detail.artist,
    image: release?.cover || packageRow?.artwork || detail.image,
    genre: release?.genre || packageRow?.genre || detail.genre,
    collection: packageRow?.collection || detail.collection || 'BVS Release',
    duration: packageRow?.duration || (release?.tracks?.length ? `${release.tracks.length} tracks` : detail.duration),
    description: release?.description || packageRow?.description || detail.description,
    price: packageRow?.price ?? detail.price,
    streamOnly: packageRow?.streamOnly ?? detail.streamOnly,
    src: packageRow?.src || detail.src,
    externalUrl: packageRow?.externalUrl || detail.externalUrl,
    albumPackage: packageRow?.albumPackage ?? detail.albumPackage,
    releaseType: release?.releaseType || detail.releaseType,
    copyrightYear: release?.copyrightYear || detail.copyrightYear,
    publishedAt: release?.publishedAt || detail.publishedAt,
    tracks: release?.tracks || detail.tracks,
    actionHref: release?.id ? `/album/${encodeURIComponent(release.id)}` : detail.actionHref || detail.href,
  } satisfies ExploreDetail
}

export default function FlowDetailsBridge() {
  const [detail, setDetail] = useState<ExploreDetail | null>(null)

  useEffect(() => {
    let requestId = 0

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = event.target instanceof HTMLElement ? event.target : null
      if (!target || target.closest('[data-flow-detail-skip="true"]')) return

      const trigger = target.closest<HTMLElement>('[data-flow-detail-trigger]')
      const anchor = target.closest<HTMLAnchorElement>('a[href]')
      let url: URL | null = null
      if (anchor) {
        try {
          url = new URL(anchor.href, window.location.origin)
        } catch {
          url = null
        }
      }

      const artistObject = !trigger && window.location.pathname.startsWith('/artist/')
        ? articleFallback(target)
        : null
      const libraryObject = !trigger && !artistObject ? libraryFallback(target, anchor) : null

      let shouldOpen = Boolean(trigger || artistObject || libraryObject)
      if (!shouldOpen && url?.origin === window.location.origin) {
        shouldOpen = url.pathname.startsWith('/album/') || (url.pathname === '/catalogue' && Boolean(url.searchParams.get('q')))
      }
      if (!shouldOpen) return

      let kind = trigger?.dataset.flowDetailTrigger || artistObject?.kind || libraryObject?.kind || ''
      if (!detailKinds.has(kind)) {
        if (url?.pathname.startsWith('/album/')) kind = 'release'
        else kind = kindFromSearchArticle(target) || ''
      }

      const queryTitle = url?.pathname === '/catalogue' ? url.searchParams.get('q') || '' : ''
      const domTitle = trigger?.dataset.flowDetailTitle || artistObject?.title || libraryObject?.title || target.closest('article')?.querySelector('h3')?.textContent || ''
      const title = domTitle.trim() || queryTitle
      const curated = curatedFor(title || queryTitle)

      if (!detailKinds.has(kind)) {
        if (url?.searchParams.get('type') === 'beat' || curated?.type === 'beat') kind = 'beat'
        else kind = 'track'
      }

      event.preventDefault()

      const fallbackHref = artistObject?.href || libraryObject?.href || ''
      const href = relativeHref(trigger?.dataset.flowDetailHref || anchor?.href || url?.toString() || fallbackHref)
      const explicit = trigger
        ? baseFromTrigger(trigger, kind as ExploreDetail['kind'], href)
        : null
      const curatedDetail = baseFromCurated(kind as ExploreDetail['kind'], title || queryTitle, href)
      const releaseId = url?.pathname.startsWith('/album/') ? decodeURIComponent(url.pathname.split('/').filter(Boolean)[1] || '') : ''
      const base: ExploreDetail = {
        ...(curatedDetail || explicit || artistObject || libraryObject || {
          id: releaseId || title || href,
          kind: kind as ExploreDetail['kind'],
          title: title || queryTitle || 'BVS item',
          artist: 'BVS creator',
          href,
          actionHref: href,
        }),
        id: trigger?.dataset.flowDetailId || releaseId || curatedDetail?.id || explicit?.id || artistObject?.id || libraryObject?.id || title || href,
        kind: kind as ExploreDetail['kind'],
        title: title || curatedDetail?.title || explicit?.title || artistObject?.title || libraryObject?.title || queryTitle || 'BVS item',
        href,
        actionHref: href,
      }

      setDetail(base)
      const currentRequest = ++requestId
      void enrich(base).then(next => {
        if (currentRequest === requestId) setDetail(next)
      })
    }

    document.addEventListener('click', onClick)
    return () => {
      requestId += 1
      document.removeEventListener('click', onClick)
    }
  }, [])

  return detail ? <ExploreItemDetails detail={detail} onClose={() => setDetail(null)} /> : null
}
