import DiscoveryDirectory from '@/components/home/DiscoveryDirectory'
import { getPublishedArtists } from '@/lib/artist-content'
import { fairDailyOrder } from '@/lib/fair-discovery-order'
export const metadata = { title: 'Artists', description: 'Discover editorially verified artists and published music on BVS Radio.' }
export default async function ArtistsDirectoryPage() {
  const artists = fairDailyOrder(await getPublishedArtists(), 'artists')
  return <DiscoveryDirectory title="Artists" kicker="The people behind the sound" description="Explore artists verified by BVS editorial and the music they have published." browseHref="/catalogue" browseLabel="Browse music" emptyMessage="Profiles will appear here after BVS editorial verification." items={artists.map(artist => ({ id: artist.id, name: artist.name, image: artist.image, href: `/artist/${encodeURIComponent(artist.username)}`, detail: `Verified ${artist.role} · ${artist.trackCount} published ${artist.trackCount === 1 ? 'track' : 'tracks'}`, description: artist.genres.join(' · ') }))} />
}
