'use client'

import { useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
  window.localStorage.setItem('bvs_theme', theme)
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark')
  useEffect(() => {
    const saved = window.localStorage.getItem('bvs_theme')
    const nextTheme: Theme = saved === 'light' || saved === 'dark' ? saved : window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
    applyTheme(nextTheme)
    const frame = window.requestAnimationFrame(() => setTheme(nextTheme))
    return () => window.cancelAnimationFrame(frame)
  }, [])
  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    applyTheme(nextTheme)
  }
  return (
    <button type="button" onClick={toggleTheme} className="theme-toggle rounded-full border border-white/20 px-3 py-2 text-sm text-text-secondary transition-colors hover:border-brand hover:text-brand" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
      <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
      <span className="sr-only">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
    </button>
  )
}
