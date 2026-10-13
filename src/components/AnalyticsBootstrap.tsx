'use client'

import { useEffect } from 'react'
import { captureFirstTouchAttribution, clearAnalyticsIdentity, setAnalyticsIdentity, trackPlatformVisit, trackReturnSessionIfNeeded } from '@/lib/analytics'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'

export default function AnalyticsBootstrap() {
  useEffect(() => {
    captureFirstTouchAttribution()
    const visit = () => trackPlatformVisit()
    const timer = window.setInterval(visit, 60_000)
    window.addEventListener('visibilitychange', visit)
    const stopVisits = () => { window.clearInterval(timer); window.removeEventListener('visibilitychange', visit) }
    if (!isSupabaseConfigured()) {
      visit()
      trackReturnSessionIfNeeded()
      return stopVisits
    }

    let alive = true
    const supabase = createClient()
    void supabase.auth.getSession().then(({ data }) => {
      if (!alive) return
      if (data.session) setAnalyticsIdentity(data.session.user.id, data.session.access_token)
      else clearAnalyticsIdentity()
      visit()
      trackReturnSessionIfNeeded()
    }).catch(() => { if (alive) visit() })

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setAnalyticsIdentity(session.user.id, session.access_token)
      else clearAnalyticsIdentity()
      visit()
    })

    return () => {
      alive = false
      stopVisits()
      data.subscription.unsubscribe()
    }
  }, [])

  return null
}
