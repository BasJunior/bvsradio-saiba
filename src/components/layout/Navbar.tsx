'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isArtistMenuOpen, setIsArtistMenuOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured()) return
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    if (!isSupabaseConfigured()) return
    await createClient().auth.signOut()
    setUser(null)
    setIsMenuOpen(false)
    window.location.href = '/'
  }

  const navLinks = [
    { href: '/radio', label: 'Listen' },
    { href: '/catalogue', label: 'Music' },
    { href: '/shows', label: 'Shows' },
    { href: '/blog', label: 'Discover' },
  ]

  const artistLinks = [
    { href: '/upload', label: 'Submit music' },
    { href: '/catalogue?type=beat', label: 'Browse beats' },
    { href: '/shop', label: 'Mixing & mastering' },
    { href: '/upload#requirements', label: 'Submission requirements' },
    { href: '/shop#services', label: 'Services & pricing' },
  ]

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-bg-primary/90 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2" onClick={() => setIsMenuOpen(false)}>
          <Image src="/assets/images/Bvsradio_logo.png" alt="BVS Radio" width={32} height={32} className="rounded" />
          <span className="text-xl font-bold text-brand" title="Best Virtual Sound">BVS Radio</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-6 text-sm">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="text-text-secondary hover:text-brand transition-colors">
              {link.label}
            </Link>
          ))}
          <div
            className="relative"
            onMouseEnter={() => setIsArtistMenuOpen(true)}
            onMouseLeave={() => setIsArtistMenuOpen(false)}
          >
            <button
              type="button"
              className="text-text-secondary hover:text-brand transition-colors"
              aria-expanded={isArtistMenuOpen}
              onClick={() => setIsArtistMenuOpen(!isArtistMenuOpen)}
            >
              For Artists <span aria-hidden="true">⌄</span>
            </button>
            {isArtistMenuOpen && (
              <div className="absolute left-1/2 top-full w-56 -translate-x-1/2 pt-3">
                <div className="rounded-xl border border-white/10 bg-bg-primary p-2 shadow-2xl">
                  {artistLinks.map((link) => (
                    <Link key={link.href} href={link.href} className="block rounded-lg px-3 py-2 text-text-secondary hover:bg-white/5 hover:text-brand">
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
          <Link href="/search" aria-label="Search BVS" className="text-text-secondary hover:text-brand transition-colors">
            Search
          </Link>
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link href="/library" className="px-3 py-2 text-sm text-text-secondary hover:text-brand transition-colors">
            Library
          </Link>
          <Link href="/checkout" className="px-3 py-2 text-sm text-text-secondary hover:text-brand transition-colors">
            Cart
          </Link>
          {user ? (
            <>
              <Link href="/admin/editorial" className="px-3 py-2 text-sm text-text-secondary hover:text-brand transition-colors">Editorial</Link>
              <span className="max-w-[10rem] truncate px-2 text-sm text-text-secondary" title={user.email || ''}>
                {user.email}
              </span>
              <button
                type="button"
                onClick={signOut}
                className="px-4 py-2 text-sm text-text-primary hover:text-brand transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="px-4 py-2 text-sm text-text-primary hover:text-brand transition-colors">
                Sign In
              </Link>
              <Link href="/auth/signup" className="px-4 py-2 text-sm font-medium bg-brand text-black rounded-full hover:bg-brand-dark transition-colors">
                Join Free
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="md:hidden p-2 text-text-secondary hover:text-brand"
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {isMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden border-t border-white/10 bg-bg-primary/95 backdrop-blur">
          <div className="px-4 py-4 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block py-2.5 text-text-secondary hover:text-brand transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-2">
              <div className="mb-1 text-xs font-semibold uppercase tracking-[2px] text-brand">For Artists</div>
              {artistLinks.map((link) => (
                <Link key={link.href} href={link.href} className="block py-2 text-text-secondary hover:text-brand" onClick={() => setIsMenuOpen(false)}>
                  {link.label}
                </Link>
              ))}
            </div>
            <Link href="/search" className="block py-2.5 text-text-secondary hover:text-brand" onClick={() => setIsMenuOpen(false)}>Search</Link>
            <Link href="/library" className="block py-2.5 text-text-secondary hover:text-brand" onClick={() => setIsMenuOpen(false)}>Library</Link>
            <Link href="/checkout" className="block py-2.5 text-text-secondary hover:text-brand" onClick={() => setIsMenuOpen(false)}>Cart</Link>
            <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
              {user ? (
                <>
                  <p className="py-1 text-sm text-text-secondary truncate">{user.email}</p>
                  <Link href="/admin/editorial" className="py-2 text-text-primary hover:text-brand" onClick={() => setIsMenuOpen(false)}>Editorial dashboard</Link>
                  <button type="button" onClick={signOut} className="py-2 text-left text-text-primary hover:text-brand">
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/auth/login" className="py-2 text-text-primary hover:text-brand" onClick={() => setIsMenuOpen(false)}>
                    Sign In
                  </Link>
                  <Link href="/auth/signup" className="py-2.5 text-center bg-brand text-black font-medium rounded-full" onClick={() => setIsMenuOpen(false)}>
                    Join Free
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
