'use client'

import Link from 'next/link'
import EditorialArtworkShortcut from '@/components/EditorialArtworkShortcut'
import { usePathname } from 'next/navigation'

/** One editorial bar on every editorial page: each desk as a matching chip. */
export default function EditorialWorkspaceNav() {
  const pathname = usePathname() || ''
  const active = pathname === '/editorial' || pathname === '/admin/editorial' || pathname.startsWith('/editorial/') || pathname.startsWith('/admin/editorial/')
  if (!active) return null
  const is = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  return <nav aria-label="Editorial workspace" className="bvs-editorial-nav relative z-30 mx-auto w-full max-w-7xl px-4 pt-3 sm:px-6">
    <div className="flex items-center justify-between gap-3">
      <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-[#a7cbea]">BVS Editorial</p>
      <Link href="/editorial#ed-overview" className="text-xs font-semibold text-brand">Needs attention →</Link>
    </div>
    <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-2">
      <Link href="/editorial" aria-current={pathname === '/editorial' || pathname === '/admin/editorial' ? 'page' : undefined} className="bvs-editorial-chip">Desk</Link>
      <Link href="/editorial/catalogue" aria-current={is('/editorial/catalogue') ? 'page' : undefined} className="bvs-editorial-chip">Catalogue</Link>
      <EditorialArtworkShortcut catalogueHref="/editorial/catalogue" />
      <Link href="/admin/editorial/distribution" aria-current={is('/admin/editorial/distribution') ? 'page' : undefined} className="bvs-editorial-chip">Distribution</Link>
      <Link href="/admin/editorial/finance/payouts" aria-current={is('/admin/editorial/finance/payouts') ? 'page' : undefined} className="bvs-editorial-chip">Payouts</Link>
      <Link href="/editorial/finance" aria-current={is('/editorial/finance') || (is('/admin/editorial/finance') && !is('/admin/editorial/finance/payouts')) ? 'page' : undefined} className="bvs-editorial-chip">Finance</Link>
      <Link href="/editorial/marketplace" aria-current={is('/editorial/marketplace') ? 'page' : undefined} className="bvs-editorial-chip">Marketplace</Link>
      <Link href="/editorial/disputes" aria-current={is('/editorial/disputes') ? 'page' : undefined} className="bvs-editorial-chip">Disputes</Link>
      <Link href="/editorial/rights" aria-current={is('/editorial/rights') ? 'page' : undefined} className="bvs-editorial-chip">Rights</Link>
      <Link href="/editorial/newsletter" aria-current={is('/editorial/newsletter') ? 'page' : undefined} className="bvs-editorial-chip">Newsletter</Link>
      <Link href="/admin/creator-workflows" className="bvs-editorial-chip">Writing &amp; research</Link>
    </div>
  </nav>
}
