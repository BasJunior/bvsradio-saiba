'use client'

import Link from 'next/link'
import EditorialArtworkShortcut from '@/components/EditorialArtworkShortcut'
import { usePathname } from 'next/navigation'

export default function EditorialWorkspaceNav() {
  const pathname = usePathname()
  const active = pathname === '/editorial' || pathname === '/admin/editorial' || pathname?.startsWith('/editorial/') || pathname?.startsWith('/admin/editorial/')
  if (!active) return null

  return <div className="relative z-30 mx-auto flex w-full max-w-7xl flex-wrap items-center gap-2 px-4 sm:px-6">
    <EditorialArtworkShortcut catalogueHref="/editorial/catalogue" />
    <Link href="/admin/editorial/finance/payouts" className="inline-flex min-h-10 items-center rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-text-secondary transition hover:border-brand/40 hover:text-brand">
      Payouts
    </Link>
  </div>
}
