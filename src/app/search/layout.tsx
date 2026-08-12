import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Explore Music, Artists & Producers',
  description: 'Explore published BVS music, releases, artists, producers, beats, shows, stories and creator services.',
  openGraph: { title: 'Explore Music, Artists & Producers | BVS Radio', description: 'Move through the music, creators and BeatStore catalogue published on BVS Radio.' },
}

export default function SearchLayout({ children }: { children: React.ReactNode }) { return children }
