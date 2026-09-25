'use client'

import { useEffect } from 'react'

/**
 * Compatibility guard while BVS ships dark mode only.
 * Keep this component non-interactive so any stale import cannot expose light mode.
 */
export default function ThemeToggle() {
  useEffect(() => {
    document.documentElement.dataset.theme = 'dark'
    document.documentElement.style.colorScheme = 'dark'
    window.localStorage.setItem('bvs_theme', 'dark')
  }, [])

  return null
}
