import type { DiscoveryItem } from './discovery'

export type LibrarySection = 'favourites' | 'follows' | 'history'

const keys: Record<LibrarySection, string> = {
  favourites: 'bvs.library.favourites.v1',
  follows: 'bvs.library.follows.v1',
  history: 'bvs.library.history.v1',
}

function safeParse(value: string | null): DiscoveryItem[] {
  if (!value) return []
  try { return JSON.parse(value) as DiscoveryItem[] } catch { return [] }
}

export function readLibrary(section: LibrarySection): DiscoveryItem[] {
  if (typeof window === 'undefined') return []
  return safeParse(window.localStorage.getItem(keys[section]))
}

export function hasLibraryItem(section: LibrarySection, id: string) {
  return readLibrary(section).some((item) => item.id === id)
}

export function toggleLibraryItem(section: LibrarySection, item: DiscoveryItem) {
  const current = readLibrary(section)
  const exists = current.some((saved) => saved.id === item.id)
  const next = exists ? current.filter((saved) => saved.id !== item.id) : [item, ...current]
  window.localStorage.setItem(keys[section], JSON.stringify(next))
  window.dispatchEvent(new CustomEvent('bvs:library-change', { detail: { section } }))
  return !exists
}

export function recordListening(item: DiscoveryItem) {
  if (typeof window === 'undefined') return
  const next = [item, ...readLibrary('history').filter((saved) => saved.id !== item.id)].slice(0, 30)
  window.localStorage.setItem(keys.history, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent('bvs:library-change', { detail: { section: 'history' } }))
}

