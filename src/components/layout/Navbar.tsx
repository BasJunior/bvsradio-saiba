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
import { appHome, isAppPrimaryRoot, primaryAppDestinations } from '@/lib/app-surface'
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
        setNotificationCount(0)
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

    }
    supabase.auth.getSession().then(({ data }) => void syncAccess(data.session?.user ?? null, data.session?.access_token))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncAccess(session?.user ?? null, session?.access_token)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    let alive = true
    const seen = async () => {
      const { data } = await createClient().auth.getSession()
      if (!data.session) { if (alive) setNotificationCount(0); return }
      const headers = {Authorization: `Bearer ${data.session.access_token}`}
      const [operations, marketplace, response] = await Promise.all([
        fetch('/api/notifications', { headers, cache:'no-store' }).catch(() => null),
        fetch('/api/marketplace/messages/notifications', { headers, cache:'no-store' }).catch(() => null),
        fetch('/api/app/participation/notifications?limit=1', { headers, cache:'no-store' }).catch(() => null),
      ])
      const operationPayload = operations?.ok ? await operations.json() : {events:[]}
      const marketplacePayload = marketplace?.ok ? await marketplace.json() : {events:[]}
      const seenAt = window.localStorage.getItem(`bvs_notifications_seen_at:${data.session.user.id}`) || ''
      const operationalUnread = (operationPayload.events || []).filter((event: {created_at:string}) => !seenAt || event.created_at > seenAt).length
      const marketplaceUnread = (marketplacePayload.events || []).filter((event: {created_at:string}) => !seenAt || event.created_at > seenAt).length
      const payload = response?.ok ? await response.json() as { unreadCount?: number } : {}
      if (alive) setNotificationCount(operationalUnread + marketplaceUnread + (Number(payload.unreadCount) || 0))
    }
    if (!isSupabaseConfigured()) return
    void seen()
    const timer = window.setInterval(() => void seen(), 60000)
    window.addEventListener('bvs:notifications-seen', seen)
    return () => { alive=false; window.clearInterval(timer); window.removeEventListener('bvs:notifications-seen', seen) }
  }, [user?.id])

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
  const studioActive = pathname === '/creator/studio' || pathname.startsWith('/creator/studio/')
  const premiumUntilLabel = formatPremiumUntil(premium?.premiumUntil ?? null)
  const premiumBadge =
    premium?.premiumActive
      ? `Premium · ${premium.premiumPlanLabel || 'Standard'}${premiumUntilLabel ? ` · through ${premiumUntilLabel}` : ''}`
      : null
  const openNotifications = () => {
    window.localStorage.setItem(`bvs_notifications_seen_at:${user?.id}`, new Date().toISOString())
    setIsMenuOpen(false)
    router.push('/notifications')
  }

  const appPrimaryLinks = surface ? primaryAppDestinations(surface) : []
  const flowBack = surface ? readFlowBackTarget(surface) : null
  const appRootActive = surface ? isAppPrimaryRoot(pathname, surface) : false

  if (appChrome && surface) {
    return (
      <header ref={appHeaderRef} className="bvs-app-header fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-bg-primary/95 backdrop-blur-2xl">
        <div className="mx-auto flex min-h-14 max-w-lg items-center justify-between gap-2 px-3 pt-[env(safe-area-inset-top)]">
          <div className="flex min-w-0 items-center gap-1">
            {!appRootActive && flowBack ? (
              <button
                type="button"
                aria-label={`Back to ${flowBack.label}`}
                onClick={() => router.push(flowBack.href)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-text-secondary hover:bg-white/5 hover:text-white"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
                </svg>
              </button>
            ) : null}
            <Link href={appHome(surface)} className="inline-flex min-w-0 items-center" aria-label="BVS Radio home">
              <Image src="/branding/bvs-logo.png" width={1032} height={552} alt="BVS Radio" className="h-9 w-auto rounded-md object-contain" priority />
            </Link>
          </div>
          <div className="flex items-center gap-1">
            <HeaderSearch iconOnly surface={surface} />
            <button
              type="button"
              onClick={openNotifications}
              className="relative grid h-9 w-9 place-items-center rounded-xl text-text-secondary hover:bg-white/5 hover:text-white"
              aria-label={`Notifications${notificationCount ? `, ${notificationCount} unread` : ''}`}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M9.5 21h5" />
              </svg>
              {notificationCount > 0 ? <span className="absolute -right-1 -top-0.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-black">{notificationCount > 9 ? '9+' : notificationCount}</span> : null}
            </button>
          </div>
        </div>
      </header>
    )
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-bg-primary/90 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center" aria-label="BVS Radio home">
          <Image src="/branding/bvs-logo.png" width={1032} height={552} alt="BVS Radio" className="h-11 w-auto rounded-md object-contain" priority />
        </Link>

        <div className="hidden md:flex items-center gap-7 text-sm font-medium tracking-wide">
          {navLinks.map((link) => <Link key={link.href} href={link.href} className="text-text-secondary hover:text-brand transition-colors">{link.label}</Link>)}
        </div>

        <div className="hidden md:flex items-center gap-2">
          <HeaderSearch />
          <Link aria-label="Cart" className="relative px-2.5 py-2 text-sm text-text-secondary hover:text-brand transition-colors" href="/checkout">Cart{cartCount > 0 ? <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-black">{cartCount > 9 ? '9+' : cartCount}</span> : null}</Link>
          {user ? (
            <>
              {showCreator ? <Link className={`px-3 py-2 text-sm transition-colors ${studioActive ? 'text-brand' : 'text-text-primary hover:text-brand'}`} href="/creator/studio">Studio</Link> : null}
              {showEditorial ? <Link className="px-3 py-2 text-sm text-text-primary hover:text-brand transition-colors" href="/editorial">Editorial</Link> : null}
              <button type="button" onClick={openNotifications} className="relative px-2.5 py-2 text-sm text-text-secondary hover:text-brand transition-colors" aria-label={`Open ${notificationCount} unread notification${notificationCount === 1 ? '' : 's'}`}>Notifications{notificationCount > 0 ? <span className="absolute -right-1 -top-0.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-black">{notificationCount > 9 ? '9+' : notificationCount}</span> : null}</button>
              {premiumBadge ? <Link href="/artist/premium" title={premiumBadge} className="rounded-full border border-brand/35 px-3 py-1.5 text-xs font-semibold text-brand">{premiumBadge}</Link> : null}
              <Link className="px-3 py-2 text-sm text-text-primary hover:text-brand transition-colors" href="/account">Account</Link>
              <button type="button" onClick={signOut} className="px-3 py-2 text-sm text-text-secondary hover:text-white transition-colors">Sign out</button>
            </>
          ) : (
            <>
              <Link className="px-3 py-2 text-sm text-text-primary hover:text-brand transition-colors" href="/auth/login">Sign in</Link>
              <Link className="px-4 py-2 text-sm font-medium bg-brand text-black rounded-full hover:bg-brand-dark transition-colors" href="/auth/signup">Join</Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 md:hidden">
          <Link aria-label="Cart" className="relative flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition hover:bg-white/5 hover:text-brand" href="/checkout"><svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 3h2l.4 2M7 13h10l3-8H6.4M7 13 5.4 5M7 13l-1.2 6h12.4M10 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm8 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" /></svg>{cartCount > 0 ? <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-black">{cartCount > 9 ? '9+' : cartCount}</span> : null}</Link>
          {user ? <button type="button" onClick={openNotifications} className="relative flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition hover:bg-white/5 hover:text-brand" aria-label={`Notifications${notificationCount ? `, ${notificationCount} unread` : ''}`}><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M9.5 21h5" /></svg>{notificationCount > 0 ? <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-black">{notificationCount > 9 ? '9+' : notificationCount}</span> : null}</button> : null}
          {!user ? <Link className="rounded-full bg-brand px-3.5 py-1.5 text-xs font-semibold tracking-wide text-black shadow-[0_0_0_1px_rgba(0,0,0,0.08)] transition hover:bg-brand-dark active:scale-[0.98]" href="/auth/signup">Join</Link> : null}
          <button type="button" onClick={() => setIsMenuOpen(!isMenuOpen)} className="rounded-lg p-2 text-text-secondary transition hover:bg-white/5 hover:text-brand" aria-label="Open menu" aria-expanded={isMenuOpen}><svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isMenuOpen ? 'M6 18 18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} /></svg></button>
        </div>
      </div>

      {isMenuOpen ? <div className="border-t border-white/10 bg-bg-primary px-4 py-4 md:hidden"><div className="grid gap-1">{navLinks.map(link => <Link onClick={() => setIsMenuOpen(false)} key={link.href} href={link.href} className="rounded-lg px-3 py-2.5 text-sm text-text-secondary hover:bg-white/5 hover:text-brand">{link.label}</Link>)}<div className="my-2 border-t border-white/10" />{serviceLinks.map(link => <Link onClick={() => setIsMenuOpen(false)} key={link.href} href={link.href} className="rounded-lg px-3 py-2.5"><span className="block text-sm text-text-primary">{link.label}</span><span className="block text-xs text-text-secondary">{link.detail}</span></Link>)}{user ? <>{showCreator ? <><div className="my-2 border-t border-white/10" />{artistLinks.map(link => <Link onClick={() => setIsMenuOpen(false)} key={link.href} href={link.href} className="rounded-lg px-3 py-2.5 text-sm text-text-secondary hover:bg-white/5 hover:text-brand">{link.label}</Link>)}</> : null}{showEditorial ? <Link onClick={() => setIsMenuOpen(false)} href="/editorial" className="rounded-lg px-3 py-2.5 text-sm text-text-secondary hover:bg-white/5 hover:text-brand">Editorial</Link> : null}<Link onClick={() => setIsMenuOpen(false)} href="/account" className="rounded-lg px-3 py-2.5 text-sm text-text-secondary hover:bg-white/5 hover:text-brand">Account</Link><button type="button" onClick={signOut} className="rounded-lg px-3 py-2.5 text-left text-sm text-text-secondary hover:bg-white/5 hover:text-white">Sign out</button></> : <><div className="my-2 border-t border-white/10" /><Link onClick={() => setIsMenuOpen(false)} href="/auth/login" className="rounded-lg px-3 py-2.5 text-sm text-text-secondary hover:bg-white/5 hover:text-brand">Sign in</Link><Link onClick={() => setIsMenuOpen(false)} href="/auth/signup" className="mt-1 rounded-lg bg-brand px-3 py-2.5 text-center text-sm font-semibold text-black">Join BVS</Link></>}</div></div> : null}
    </nav>
  )
}
