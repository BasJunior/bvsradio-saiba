import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sound Shelf',
  description: 'Drum kits, loops, MIDI packs and templates from Zimbabwean and African producers on BVS Radio. Reviewed by BVS, with private download after payment.',
}

export default function ProductShelfLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
