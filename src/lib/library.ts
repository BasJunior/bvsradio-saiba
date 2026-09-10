import type { DiscoveryItem } from './discovery'

export type LibrarySection = 'favourites' | 'follows' | 'history'

const keys: Record<LibrarySection, string> = {
  favourites: 'bvs.library.favourites.v1',
  follows: 'bvs.library.follows.v1',
  history: 'bvs.library.history.v1',
}

const cacheOwnerKey = 'bvs.library.cache-owner.v1'

function safeParse(value: string | null): DiscoveryItem[] {
  if (!value) return []
  try { return JSON.parse(value) as DiscoveryItem[] } catch { return [] }
}

function normalizeLibraryItem(item: DiscoveryItem): DiscoveryItem {
  if (item.kind !== 'beat') return item
  const beatId = String(item.id || '').replace(/^beat-/, '')
  if (!/^[0-9a-f-]{36}$/i.test(beatId)) return item
  const href = `/beat/${beatId}`
  return item.href === href ? item : { ...item, href }
}

export function readLibrary(section: LibrarySection): DiscoveryItem[] {
  if (typeof window === 'undefined') return []
  return safeParse(window.localStorage.getItem(keys[section])).map(normalizeLibraryItem)
}

export function writeLibrary(section: LibrarySection, items: DiscoveryItem[], source: 'local' | 'remote' = 'local') {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(keys[section], JSON.stringify(items.map(normalizeLibraryItem)))
  window.dispatchEvent(new CustomEvent('bvs:library-change', { detail: { section, source } }))
}

export function getLibraryCacheOwner() {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(cacheOwnerKey) || ''
}

export function setLibraryCacheOwner(userId?: string | null) {
  if (typeof window === 'undefined') return
  const next = String(userId || '').trim()
  if (next) window.localStorage.setItem(cacheOwnerKey, next)
  else window.localStorage.removeItem(cacheOwnerKey)
}

export function clearLibraryCache() {
  if (typeof window === 'undefined') return
  ;(Object.keys(keys) as LibrarySection[]).forEach((section) => writeLibrary(section, [], 'remote'))
  setLibraryCacheOwner(null)
}

export function clearAccountLibraryCache() {
  if (!getLibraryCacheOwner()) return false
  clearLibraryCache()
  return true
}

export function hasLibraryItem(section: LibrarySection, id: string) {
  return readLibrary(section).some((item) => item.id === id)
}

export function toggleLibraryItem(section: LibrarySection, item: DiscoveryItem) {
  const current = readLibrary(section)
  const normalizedItem = normalizeLibraryItem(item)
  const exists = current.some((saved) => saved.id === normalizedItem.id)
  const next = exists ? current.filter((saved) => saved.id !== normalizedItem.id) : [normalizedItem, ...current]
  writeLibrary(section, next)
  window.dispatchEvent(new CustomEvent('bvs:library-mutation', { detail: { section, item: normalizedItem, saved: !exists } }))
  return !exists
}

export function recordListening(item: DiscoveryItem) {
  if (typeof window === 'undefined') return
  const normalizedItem = normalizeLibraryItem(item)
  const next = [normalizedItem, ...readLibrary('history').filter((saved) => saved.id !== normalizedItem.id)].slice(0, 30)
  writeLibrary('history', next)
  window.dispatchEvent(new CustomEvent('bvs:library-mutation', { detail: { section: 'history', item: normalizedItem, saved: true } }))
}
