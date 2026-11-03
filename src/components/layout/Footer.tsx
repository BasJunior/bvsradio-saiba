'use client'

import Link from 'next/link'
import { useAppSurface } from '@/components/app/AppSurfaceProvider'

export default function Footer() {
  const { appChrome, isNative, exitAppChrome } = useAppSurface()

  if (appChrome) {
    return (
      <footer className="bvs-app-footer border-t border-white/10 px-4 py-8 text-center text-xs text-text-secondary">
        <p>Focused listening edition · rights reviewed by BVS Editorial</p>
        <div className="mt-3 flex flex-wrap justify-center gap-4">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/contact">Support</Link>
          <Link href="/newsletter">Newsletter</Link>
          {!isNative && <button type="button" onClick={exitAppChrome} className="text-brand hover:underline">Full website</button>}
        </div>
        <p className="mt-4">&copy; {new Date().getFullYear()} BVS Radio</p>
      </footer>
    )
  }
  // Website footer: brand introduction, three link groups, then legal information.
  // Update destinations in these groups; the grid wraps to two columns on small screens.
  const groups = [
    { title: 'Listen & discover', links: [
      ['Discover music, beats & shows', '/search'], ['Your Library', '/library'],
      ['Community Feed', '/feed'], ['Live Radio', '/radio'],
    ] },
    { title: 'Create with BVS', links: [
      ['Creator Studio', '/creator/studio'], ['Creator Marketplace', '/marketplace'],
      ['BVS Studio Services', '/shop'], ['Premium', '/premium'],
    ] },
    { title: 'About & support', links: [
      ['Our story', '/about'], ['BVS Newsletter', '/newsletter'],
      ['FAQ', '/faq'], ['Contact', '/contact'],
    ] },
  ]
  const linkStyle = 'inline-flex min-h-11 items-center py-2 text-sm leading-relaxed text-white/60 transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand'

  return (
    <footer className="border-t border-white/15 bg-[#101012]">
      <div className="mx-auto max-w-7xl px-4 pb-8 pt-10 sm:px-6 sm:pt-12">
        <div className="grid gap-9 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-16">
          {/* BRAND — keep this short; the homepage already explains the platform. */}
          <div>
            <Link href="/" className="inline-flex min-h-11 items-center text-xl font-bold tracking-tight text-brand focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">BVS Radio</Link>
            <p className="mt-3 max-w-sm text-sm leading-7 text-white/60">Best Virtual Sound. Independent music, radio and creator tools. Rooted in Zimbabwe, open to the world.</p>
            <nav aria-label="BVS social channels" className="mt-4 flex flex-wrap gap-x-5 gap-y-1">
              {[
                ['Instagram', 'https://instagram.com/bvsradio'],
                ['Twitter / X', 'https://twitter.com/bvsradio'],
                ['Facebook', 'https://facebook.com/bvsradio'],
              ].map(([label, href]) => <a key={href} href={href} target="_blank" rel="noopener noreferrer" className={linkStyle}>{label}<span aria-hidden="true" className="ml-1.5 text-white/35">↗</span><span className="sr-only"> (opens in a new tab)</span></a>)}
            </nav>
          </div>

          {/* DIRECTORIES — two columns on mobile, three from tablet widths upward. */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-3">
            {groups.map(group => <nav key={group.title} aria-label={`Footer: ${group.title}`}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-[.12em] text-white/85">{group.title}</h2>
              <ul>
                {group.links.map(([label, href]) => <li key={href}><Link href={href} className={linkStyle}>{label}</Link></li>)}
              </ul>
            </nav>)}
          </div>
        </div>

        {/* LEGAL — wrapping links keep policies accessible without a tall extra column. */}
        <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-5 text-xs text-white/45 md:flex-row md:items-center md:justify-between">
          <p>&copy; {new Date().getFullYear()} BVS Radio. All rights reserved.</p>
          <nav aria-label="Legal information" className="flex flex-wrap gap-x-5 gap-y-1">
            {[
              ['Privacy', '/privacy'], ['Terms', '/terms'],
              ['Copyright', '/copyright'], ['Refunds', '/refunds'],
            ].map(([label, href]) => <Link key={href} href={href} className="inline-flex min-h-11 items-center hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">{label}</Link>)}
          </nav>
        </div>
      </div>
    </footer>
  )
}
