'use client'

import { useEffect } from 'react'
import { trackEventOnce } from '@/lib/analytics'

export default function CreatorFormAnalytics({ intent }: { intent: 'release' | 'beat' | 'service' }) {
  useEffect(() => {
    trackEventOnce('create_form_started', { intent, source: 'studio_create' }, intent)
  }, [intent])
  return null
}
