'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function EditorialWorkspaceNav() {
  const pathname = usePathname()
  const active = pathname === '/editorial' || pathname === '/admin/editorial' || pathname?.startsWith('/editorial/') || pathname?.startsWith('/admin/editorial/')
  if (!active) return null

  const catalogue = pathname?.startsWith('/editorial/catalogue')
  const workflow = pathname === '/editorial' || pathname === '/admin/editorial'

  return (
    <div className="mx-auto w-full max-w-[96rem] px-4 pt-4 sm:px-6 lg:px-8">
      <nav aria-label="Editorial workspace" className="flex w-fit flex-wrap items-center gap-1 rounded-full border border-white/10 bg-bg-primary/80 p-1 backdrop-blur-xl">
        <Link href="/editorial" className={`rounded-full px-3 py-1.5 text-xs transition ${workflow ? 'bg-white/10 text-white' : 'text-text-secondary hover:text-white'}`}>Workflow</Link>
        <Link href="/editorial/catalogue" className={`rounded-full px-3 py-1.5 text-xs transition ${catalogue ? 'bg-brand text-black' : 'text-text-secondary hover:text-brand'}`}>Catalogue normalization</Link>
      </nav>
    </div>
  )
}
