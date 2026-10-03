'use client'

import EditorialArtworkShortcut from '@/components/EditorialArtworkShortcut'
import { usePathname } from 'next/navigation'

export default function EditorialWorkspaceNav() {
  const pathname = usePathname()
  const active = pathname === '/editorial' || pathname === '/admin/editorial' || pathname?.startsWith('/editorial/') || pathname?.startsWith('/admin/editorial/')
  if (!active) return null

  return <div className="relative z-30 mx-auto w-full max-w-7xl px-4 sm:px-6"><EditorialArtworkShortcut catalogueHref="/editorial/catalogue" /></div>
}
