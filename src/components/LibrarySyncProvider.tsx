'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { DiscoveryItem } from '@/lib/discovery'
import { readLibrary, writeLibrary, type LibrarySection } from '@/lib/library'
import { createClient } from '@/lib/supabase'

type SyncState = 'device' | 'syncing' | 'synced' | 'error'
type SyncContextValue = { state: SyncState; signedIn: boolean; syncNow: () => Promise<void> }
type MutationDetail = { section: LibrarySection; item: DiscoveryItem; saved: boolean }
type LibraryResponse = { libraries?: Record<LibrarySection, DiscoveryItem[]>; error?: string }

const LibrarySyncContext = createContext<SyncContextValue>({ state: 'device', signedIn: false, syncNow: async () => {} })

export function LibrarySyncProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SyncState>('device')
  const [signedIn, setSignedIn] = useState(false)

  const request = useCallback(async (body: object) => {
    const supabase = createClient()
    const { data } = await supabase.auth.getSession()
    if (!data.session) throw new Error('Not signed in')
    const response = await fetch('/api/library', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
      body: JSON.stringify(body),
    })
    const payload = await response.json() as LibraryResponse
    if (!response.ok || !payload.libraries) throw new Error(payload.error || 'Library sync failed')
    return payload.libraries
  }, [])

  const applyRemote = useCallback((libraries: Record<LibrarySection, DiscoveryItem[]>) => {
    (Object.keys(libraries) as LibrarySection[]).forEach((section) => writeLibrary(section, libraries[section], 'remote'))
  }, [])

  const syncNow = useCallback(async () => {
    setState('syncing')
    try {
      const libraries = await request({ operation: 'merge', libraries: {
        favourites: readLibrary('favourites'),
        follows: readLibrary('follows'),
        history: readLibrary('history'),
      } })
      applyRemote(libraries)
      setSignedIn(true)
      setState('synced')
    } catch {
      const { data } = await createClient().auth.getSession()
      setSignedIn(Boolean(data.session))
      setState(data.session ? 'error' : 'device')
    }
  }, [applyRemote, request])

  useEffect(() => {
    const supabase = createClient()
    const initialSync = window.setTimeout(syncNow, 0)
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session))
      if (session) window.setTimeout(syncNow, 0)
      else setState('device')
    })
    return () => {
      window.clearTimeout(initialSync)
      data.subscription.unsubscribe()
    }
  }, [syncNow])

  useEffect(() => {
    const onMutation = async (event: Event) => {
      if (!signedIn) return
      const detail = (event as CustomEvent<MutationDetail>).detail
      if (!detail) return
      setState('syncing')
      try {
        applyRemote(await request({ operation: 'set', ...detail }))
        setState('synced')
      } catch {
        setState('error')
      }
    }
    window.addEventListener('bvs:library-mutation', onMutation)
    return () => window.removeEventListener('bvs:library-mutation', onMutation)
  }, [applyRemote, request, signedIn])

  return <LibrarySyncContext.Provider value={{ state, signedIn, syncNow }}>{children}</LibrarySyncContext.Provider>
}

export function useLibrarySync() {
  return useContext(LibrarySyncContext)
}
