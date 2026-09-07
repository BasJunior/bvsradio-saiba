'use client'

import { useEffect } from 'react'
import { captureFirstTouchAttribution, trackReturnSessionIfNeeded } from '@/lib/analytics'

export default function AnalyticsBootstrap() {
  useEffect(() => {
    captureFirstTouchAttribution()
    trackReturnSessionIfNeeded()
  }, [])

  return null
}
