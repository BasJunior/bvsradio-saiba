'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Footer() {
  const pathname = usePathname()
  const routeSurface = pathname.match(/^\/app\/(ios|android)(?:\/|$)/)?.[1] as 'ios' | 'android' | undefined
  const [mobileSurface] = useState<'ios' | 'android' | null>(routeSurface || null)

  if (mobileSurface) {
    return (
      <footer className="mt-12 border-t border-white/10 px-4 py-8 text-center text-xs text-text-secondary">
        <p>Curated mobile catalogue · Rights reviewed by BVS Editorial</p>
        <div className="mt-3 flex justify-center gap-4"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/contact">Support</Link></div>
        <p className="mt-4">&copy; {new Date().getFullYear()} BVS Radio</p>
      </footer>
    )
  }
  return (
    <footer className="mt-20 border-t border-white/10 bg-bg-secondary/50">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div>
            <h3 className="mb-4 font-serif text-xl font-semibold text-brand">BVS Radio</h3>
            <p className="text-sm text-text-secondary">
              BVS Radio (Best Virtual Sound) — Zimbabwe&apos;s online radio and creative platform. Listen to the live rotation, discover the scene, work with providers and keep what matters in your Library.
            </p>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-text-primary">Listen &amp; discover</h4>
            <div className="flex flex-col gap-2">
              <Link href="/radio" className="text-sm text-text-secondary transition-colors hover:text-brand">Live Radio</Link>
              <Link href="/search" className="text-sm text-text-secondary transition-colors hover:text-brand">Explore</Link>
              <Link href="/music/artists" className="text-sm text-text-secondary transition-colors hover:text-brand">Artists</Link>
              <Link href="/music/producers" className="text-sm text-text-secondary transition-colors hover:text-brand">Producers</Link>
              <Link href="/catalogue" className="text-sm text-text-secondary transition-colors hover:text-brand">Music &amp; Beats</Link>
              <Link href="/shows" className="text-sm text-text-secondary transition-colors hover:text-brand">Shows</Link>
              <Link href="/blog" className="text-sm text-text-secondary transition-colors hover:text-brand">Stories</Link>
            </div>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-text-primary">Create &amp; marketplace</h4>
            <div className="flex flex-col gap-2">
              <Link href="/creator/studio" className="text-sm text-text-secondary transition-colors hover:text-brand">Creator Studio</Link>
              <Link href="/upload" className="text-sm text-text-secondary transition-colors hover:text-brand">Submit music</Link>
              <Link href="/premium" className="text-sm text-text-secondary transition-colors hover:text-brand">Premium</Link>
              <Link href="/marketplace" className="text-sm text-text-secondary transition-colors hover:text-brand">Marketplace</Link>
              <Link href="/marketplace/wolfbridges-studio" className="text-sm text-text-secondary transition-colors hover:text-brand">WolfBridges Studio</Link>
              <Link href="/marketplace/bvs-studio-services" className="text-sm text-text-secondary transition-colors hover:text-brand">BVS Studio Services</Link>
            </div>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-text-primary">Company &amp; social</h4>
            <div className="flex flex-col gap-2">
              <Link href="/about" className="text-sm text-text-secondary transition-colors hover:text-brand">About</Link>
              <Link href="/faq" className="text-sm text-text-secondary transition-colors hover:text-brand">FAQ</Link>
              <Link href="/contact" className="text-sm text-text-secondary transition-colors hover:text-brand">Contact</Link>
              <Link href="/privacy" className="text-sm text-text-secondary transition-colors hover:text-brand">Privacy</Link>
              <Link href="/terms" className="text-sm text-text-secondary transition-colors hover:text-brand">Terms</Link>
              <Link href="/refunds" className="text-sm text-text-secondary transition-colors hover:text-brand">Refunds</Link>
              <a href="https://instagram.com/bvsradio" target="_blank" rel="noopener noreferrer" className="text-sm text-text-secondary transition-colors hover:text-brand">Instagram</a>
              <a href="https://twitter.com/bvsradio" target="_blank" rel="noopener noreferrer" className="text-sm text-text-secondary transition-colors hover:text-brand">Twitter / X</a>
              <a href="https://facebook.com/bvsradio" target="_blank" rel="noopener noreferrer" className="text-sm text-text-secondary transition-colors hover:text-brand">Facebook</a>
            </div>
          </div>
        </div>
        <div className="mt-8 border-t border-white/10 pt-8 text-center text-xs text-text-secondary">
          &copy; {new Date().getFullYear()} BVS Radio. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
