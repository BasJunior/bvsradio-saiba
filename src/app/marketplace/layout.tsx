import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Creator Marketplace | BVS Radio',
  description: 'Discover approved African music creators, buy beats and creator products, and explore professional services on BVS Radio.',
}

export default function MarketplaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
