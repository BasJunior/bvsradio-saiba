'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import HeaderSearch from '@/components/layout/HeaderSearch'
import { useAppSurface } from '@/components/app/AppSurfaceProvider'
import { useAppShellMeasurement } from '@/components/app/useAppShellMeasurement'
import { appExplore, appHome, isAppPrimaryRoot, primaryAppDestinations } from '@/lib/app-surface'
import { readFlowBackTarget } from '@/lib/flow-session'
import { BVS_CART_EVENT, BVS_CART_KEY, cartItemCount } from '@/lib/cart-client'
type Access = {
  artist: boolean
  creator: boolean
  writer: boolean
  showCreator: boolean
  editorial: boolean
  admin: boolean
}

type PremiumInfo = {
  premiumActive: boolean
  premiumUntil: string | null
  premiumPlanLabel: string | null
}

function formatPremiumUntil(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { surface, appChrome } = useAppSurface()
  const appHeaderRef = useAppShellMeasurement<HTMLElement>('--bvs-app-header-height-measured', appChrome)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [access, setAccess] = useState<Access | null>(null)
  const [premium, setPremium] = useState<PremiumInfo | null>(null)
  const [notificationCount, setNotificationCount] = useState(0)
  const [cartCount, setCartCount] = useState(0)

  useEffect(() => {
    if (!isSupabaseConfigured()) return
    const supabase = createClient()
    const syncAccess = async (nextUser: User | null, token?: string) => {
      setUser(nextUser)
      if (!nextUser || !token) {
        setAccess(null)
        setPremium(null)
        return
      }
      const response = await fetch('/api/auth/access', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      if (!response.ok) {
        setAccess(null)
        setPremium(null)
        return
      }
      const payload = await response.json() as {
        access?: Access
        premiumActive?: boolean
        premiumUntil?: string | null
        premiumPlanLabel?: string | null
      }
      setAccess(payload.access ?? null)
      setPremium({
        premiumActive: Boolean(payload.premiumActive),
        premiumUntil: payload.premiumUntil ?? null,
        premiumPlanLabel: payload.premiumPlanLabel ?? null,
      })
      const notifications = await fetch('/api/notifications', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      if (notifications.ok) {
        const data = await notifications.json() as { events?: Array<{ created_at: string }> }
        const seenAt = window.localStorage.getItem('bvs_notifications_seen_at') || ''
        setNotificationCount((data.events || []).filter(event => !seenAt || event.created_at > seenAt).length)
      }
    }
    supabase.auth.getSession().then(({ data }) => void syncAccess(data.session?.user ?? null, data.session?.access_token))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncAccess(session?.user ?? null, session?.access_token)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const seen = () => setNotificationCount(0)
    window.addEventListener('bvs:notifications-seen', seen)
    return () => window.removeEventListener('bvs:notifications-seen', seen)
  }, [])

  useEffect(() => {
    const syncCart = (detailCount?: number) => {
      if (typeof detailCount === 'number' && Number.isFinite(detailCount)) {
        setCartCount(Math.max(0, Math.floor(detailCount)))
        return
      }
      setCartCount(cartItemCount())
    }
    syncCart()
    const onCartEvent = (event: Event) => {
      const custom = event as CustomEvent<{ count?: number }>
      syncCart(custom.detail?.count)
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === BVS_CART_KEY || event.key === null) syncCart()
    }
    const onFocus = () => syncCart()
    window.addEventListener(BVS_CART_EVENT, onCartEvent as EventListener)
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.removeEventListener(BVS_CART_EVENT, onCartEvent as EventListener)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [])

  const signOut = async () => {
    if (!isSupabaseConfigured()) return
    await createClient().auth.signOut()
    setUser(null)
    setAccess(null)
    setPremium(null)
    setNotificationCount(0)
    setIsMenuOpen(false)
    router.push('/')
    router.refresh()
  }

  // BVS Flow keeps listener movement short. Creator and operational paths live
  // behind the workspace/account surfaces instead of competing with discovery.
  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/search', label: 'Explore' },
    { href: '/catalogue?type=beat#beatstore', label: 'Beats' },
    { href: '/library', label: 'Library' },
  ]

  const serviceLinks = [
    { href: '/marketplace', label: 'Creator Marketplace', detail: 'Creator products and professional talent' },
    { href: '/shop', label: 'BVS Studio Services', detail: 'Official BVS mixing, mastering and production' },
  ]

  const artistLinks = [
    { href: '/creator/studio#artist-access', label: 'Artist access in Studio' },
    { href: '/upload', label: 'Submit music' },
    { href: '/upload?type=beats', label: 'Submit beat' },
    { href: '/premium', label: 'Premium' },
    { href: '/catalogue?type=beat#beatstore', label: 'BeatStore' },
    { href: '/creator/studio#marketplace-desk', label: 'Manage marketplace' },
  ]

  const showCreator = Boolean(access?.creator)
  const showEditorial = Boolean(access?.editorial)
  const premiumUntilLabel = formatPremiumUntil(premium?.premiumUntil ?? null)
  const premiumBadge =
    premium?.premiumActive
      ? `Premium · ${premium.premiumPlanLabel || 'Standard'}${premiumUntilLabel ? ` · through ${premiumUntilLabel}` : ''}`
      : null
  const openNotifications = () => {
    window.localStorage.setItem('bvs_notifications_seen_at', new Date().toISOString())
    setNotificationCount(0)
    setIsMenuOpen(false)
  }
  const notificationBadge = notificationCount > 0 ? (
    <Link
      href="/notifications"
      onClick={openNotifications}
      aria-label={`Open ${notificationCount} unread notification${notificationCount === 1 ? '' : 's'}`}
      className="absolute -right-1 -top-0.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-black"
    >
      {notificationCount > 9 ? '9+' : notificationCount}
    </Link>
  ) : null

  if (appChrome && surface) {
    const destinations = primaryAppDestinations(surface)
    const showBack = !isAppPrimaryRoot(pathname, surface)
    const goBack = () => {
      const route = `${window.location.pathname}${window.location.search}${window.location.hash}`
      if (readFlowBackTarget(route)) {
        router.back()
      } else {
        router.replace(appHome(surface))
      }
    }
    return (
      <nav ref={appHeaderRef} className="bvs-app-header fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-bg-primary/95 backdrop-blur-xl">
        <div className="bvs-app-header-inner mx-auto flex h-16 max-w-5xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1">
            {showBack ? (
              <button
                type="button"
                onClick={goBack}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-2xl text-brand transition hover:bg-brand/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                aria-label="Back to previous screen"
              >
                ‹
              </button>
            ) : null}
            <Link href={appHome(surface)} replace className="flex min-w-0 items-center gap-2" aria-label="BVS Radio app home">
              <Image src="/branding/bvs-logo.png" alt="BVS Radio" width={1032} height={552} className="h-10 w-auto rounded-md object-contain" priority />
            </Link>
          </div>
          <div className="hidden items-center gap-5 text-sm font-medium md:flex">
            {destinations.map((item) => (
              <Link key={item.id} href={item.href} className={`transition-colors ${pathname === item.href.split('?')[0] ? 'text-brand' : 'text-text-secondary hover:text-brand'}`}>
                {item.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <div className="hidden md:block"><HeaderSearch /></div>
            <Link
              href={appExplore(surface)}
              aria-label="Search BVS"
              className="grid h-10 w-10 place-items-center rounded-full text-text-secondary hover:bg-white/5 hover:text-brand md:hidden"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" />
                <path strokeLinecap="round" d="m16 16 4 4" />
              </svg>
            </Link>
            <Link href="/account" className="rounded-full border border-white/15 px-3 py-2 text-xs sm:text-sm">Account</Link>
          </div>
        </div>
      </nav>
    )
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-bg-primary/90 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center" onClick={() => setIsMenuOpen(false)} aria-label="BVS Radio home">
          <Image
            src="/branding/bvs-logo.png"
            alt="BVS Radio"
            width={1032}
            height={552}
            className="h-11 w-auto rounded-md object-contain"
            priority
          />
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-7 text-sm font-medium tracking-wide">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="text-text-secondary hover:text-brand transition-colors">
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2">
          <HeaderSearch />
          <Link
            href="/checkout"
            aria-label={cartCount > 0 ? `Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}` : 'Cart'}
            className="relative px-2.5 py-2 text-sm text-text-secondary hover:text-brand transition-colors"
          >
            Cart
            {cartCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-black">
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
          </Link>
          {user ? (
            <>
              {showCreator && <span className="relative"><Link href="/creator/studio" className="block px-2.5 py-2 text-sm text-text-secondary hover:text-brand transition-colors">Studio</Link>{!showEditorial && notificationBadge}</span>}
              {showEditorial && <span className="relative"><Link href="/editorial" className="block px-2.5 py-2 text-sm text-text-secondary hover:text-brand transition-colors">Editorial</Link>{notificationBadge}</span>}
              {premiumBadge && (
                <Link
                  href="/artist/premium"
                  title={premiumBadge}
                  className="max-w-[14rem] truncate rounded-full border border-brand/40 bg-brand/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-brand hover:bg-brand/20"
                >
                  {premiumBadge}
                </Link>
              )}
              <span className="relative"><Link href="/account" className="block px-2.5 py-2 text-sm text-text-primary hover:text-brand transition-colors">Account</Link>{!showCreator && !showEditorial && notificationBadge}</span>
              <button
                type="button"
                onClick={signOut}
                className="ml-1 px-3 py-2 text-sm text-text-primary hover:text-brand transition-colors"
                title={user.email || 'Sign out'}
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="px-3 py-2 text-sm text-text-primary hover:text-brand transition-colors">
                Sign in
              </Link>
              <Link href="/auth/signup" className="px-4 py-2 text-sm font-medium bg-brand text-black rounded-full hover:bg-brand-dark transition-colors">
                Join
              </Link>
            </>
          )}
        </div>

        {/* Mobile: keep Join one tap away (not only inside the drawer) */}
        <div className="flex items-center gap-1.5 md:hidden">
          <Link
            href="/checkout"
            aria-label={cartCount > 0 ? `Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}` : 'Cart'}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition hover:bg-white/5 hover:text-brand"
            onClick={() => setIsMenuOpen(false)}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 3h2l.4 2M7 13h10l3-8H6.4M7 13 5.4 5M7 13l-1.2 6h12.4M10 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm8 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
            </svg>
            {cartCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold leading-none text-black">
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
          </Link>
          {!user && (
            <Link
              href="/auth/signup"
              className="rounded-full bg-brand px-3.5 py-1.5 text-xs font-semibold tracking-wide text-black shadow-[0_0_0_1px_rgba(0,0,0,0.08)] transition hover:bg-brand-dark active:scale-[0.98]"
              onClick={() => setIsMenuOpen(false)}
            >
              Join
            </Link>
          )}
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="rounded-lg p-2 text-text-secondary transition hover:bg-white/5 hover:text-brand"
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMenuOpen}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              {isMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain border-t border-white/10 bg-bg-primary/95 pb-[calc(7rem+env(safe-area-inset-bottom))] backdrop-blur md:hidden">
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
              <div className="mb-1 text-xs font-semibold uppercase tracking-[2px] text-brand">BVS Services</div>
              {serviceLinks.map((link) => (
                <Link key={link.href} href={link.href} className="block py-2 text-text-secondary hover:text-brand" onClick={() => setIsMenuOpen(false)}>
                  <span className="block">{link.label}</span>
                  <span className="block text-xs text-text-secondary/70">{link.detail}</span>
                </Link>
              ))}
            </div>
            <div className="pt-2">
              <div className="mb-1 text-xs font-semibold uppercase tracking-[2px] text-brand">For Artists</div>
              {artistLinks.map((link) => (
                <Link key={link.href} href={link.href} className="block py-2 text-text-secondary hover:text-brand" onClick={() => setIsMenuOpen(false)}>
                  {link.label}
                </Link>
              ))}
            </div>
            <Link href="/checkout" className="flex items-center justify-between py-2.5 text-text-secondary hover:text-brand" onClick={() => setIsMenuOpen(false)}>
              <span>Cart</span>
              {cartCount > 0 && (
                <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-black">{cartCount > 9 ? '9+' : cartCount}</span>
              )}
            </Link>
            <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
              {user ? (
                <>
                  <p className="py-1 text-sm text-text-secondary truncate">{user.email}</p>
                  {premiumBadge && (
                    <Link
                      href="/artist/premium"
                      className="block rounded-xl border border-brand/30 bg-brand/10 px-3 py-2 text-sm font-semibold text-brand"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {premiumBadge}
                    </Link>
                  )}
                  <Link href="/account" className="flex items-center justify-between py-2 text-text-primary hover:text-brand" onClick={() => setIsMenuOpen(false)}><span>Account Centre</span>{!showCreator && !showEditorial && notificationCount > 0 && <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-black">{notificationCount > 9 ? '9+' : notificationCount}</span>}</Link>
                  {showCreator && <Link href="/creator/studio" className="flex items-center justify-between py-2 text-text-primary hover:text-brand" onClick={() => setIsMenuOpen(false)}><span>Creator studio</span>{!showEditorial && notificationCount > 0 && <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-black">{notificationCount > 9 ? '9+' : notificationCount}</span>}</Link>}
                  {showEditorial && <Link href="/editorial" className="flex items-center justify-between py-2 text-text-primary hover:text-brand" onClick={() => setIsMenuOpen(false)}><span>Editorial dashboard</span>{notificationCount > 0 && <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-black">{notificationCount > 9 ? '9+' : notificationCount}</span>}</Link>}
                  {showEditorial && <Link href="/admin/creator-workflows" className="py-2 text-text-primary hover:text-brand" onClick={() => setIsMenuOpen(false)}>Writing &amp; research review</Link>}
                  <Link href="/notifications" className="flex items-center justify-between py-2 text-text-primary hover:text-brand" onClick={openNotifications}><span>Notifications</span>{notificationCount > 0 && <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-black">{notificationCount > 9 ? '9+' : notificationCount}</span>}</Link>
                  <button type="button" onClick={signOut} className="py-2 text-left text-text-primary hover:text-brand">
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/auth/login" className="py-2 text-text-primary hover:text-brand" onClick={() => setIsMenuOpen(false)}>
                    Sign in
                  </Link>
                  <Link href="/auth/signup" className="py-2.5 text-center bg-brand text-black font-medium rounded-full" onClick={() => setIsMenuOpen(false)}>
                    Join
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
