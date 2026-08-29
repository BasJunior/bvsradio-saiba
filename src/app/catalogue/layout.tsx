import type { Metadata } from 'next'
import CatalogueDeepLinkJump from '@/components/CatalogueDeepLinkJump'

export const metadata: Metadata = {
  title: 'BeatStore & Music Catalogue',
  description: 'Preview published beats, discover releases and explore licensing options on BVS Radio.',
  openGraph: { title: 'BeatStore | BVS Radio', description: 'Preview published beats and explore creator licensing on BVS Radio.' },
}

export default function CatalogueLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CatalogueDeepLinkJump />
      {children}
    </>
  )
}
