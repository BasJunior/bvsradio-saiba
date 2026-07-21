'use client'

import { useEffect } from 'react'

/**
 * Supabase sends failed confirmations to Site URL with:
 *   /?error=access_denied&error_code=otp_expired&error_description=...
 * Often also mirrored in the hash. If Site URL is still localhost, members
 * land on a broken home page. Forward those failures to /auth/confirmed.
 */
export default function AuthLinkRescue() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const url = new URL(window.location.href)
    const path = url.pathname
    if (path.startsWith('/auth/confirmed') || path.startsWith('/auth/reset-password')) return

    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''))
    const error = url.searchParams.get('error') || hashParams.get('error')
    const errorCode = url.searchParams.get('error_code') || hashParams.get('error_code')
    const description =
      url.searchParams.get('error_description') || hashParams.get('error_description')

    // Success tokens should only be handled on /auth/confirmed — if they land
    // on home (wrong Site URL), still forward them there.
    const code = url.searchParams.get('code') || hashParams.get('code')
    const tokenHash = url.searchParams.get('token_hash') || hashParams.get('token_hash')
    const accessToken = hashParams.get('access_token')

    const isAuthFailure = Boolean(error || errorCode)
    const isAuthSuccess = Boolean(code || tokenHash || accessToken)
    if (!isAuthFailure && !isAuthSuccess) return

    const next = new URL('/auth/confirmed', window.location.origin)
    for (const [key, value] of url.searchParams.entries()) next.searchParams.set(key, value)
    for (const [key, value] of hashParams.entries()) {
      if (!next.searchParams.has(key)) next.searchParams.set(key, value)
    }
    // Keep hash tokens for setSession / detectSessionInUrl on confirmed page
    if (url.hash && (accessToken || tokenHash || error)) {
      next.hash = url.hash.replace(/^#/, '')
    }
    window.location.replace(next.toString())
  }, [])

  return null
}
