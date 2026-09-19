'use client'

import { useEffect } from 'react'
import { captureFirstTouchAttribution, clearAnalyticsIdentity, setAnalyticsIdentity, trackReturnSessionIfNeeded } from '@/lib/analytics'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'

export default function AnalyticsBootstrap() {
  useEffect(() => {
    captureFirstTouchAttribution()
    if (!isSupabaseConfigured()) {
      trackReturnSessionIfNeeded()
      return
    }

    let alive = true
    const supabase = createClient()
    void supabase.auth.getSession().then(({ data }) => {
      if (!alive) return
      if (data.session) setAnalyticsIdentity(data.session.user.id, data.session.access_token)
      else clearAnalyticsIdentity()
      trackReturnSessionIfNeeded()
    })

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setAnalyticsIdentity(session.user.id, session.access_token)
      else clearAnalyticsIdentity()
    })

    return () => {
      alive = false
      data.subscription.unsubscribe()
    }
  }, [])

  return null
}
