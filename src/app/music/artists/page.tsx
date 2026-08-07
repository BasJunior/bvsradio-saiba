import Image from 'next/image'
import Link from 'next/link'
import { getPublishedArtists } from '@/lib/artist-content'

export const metadata = {
  title: 'Artists',
  description: 'Discover editorially verified artists and published music on BVS Radio.',
}

export default async function ArtistsDirectoryPage() {
  const artists = await getPublishedArtists()

  return (
    <main className="mx-auto min-h-[70vh] max-w-6xl px-6 py-12">
      <p className="text-xs uppercase tracking-[0.25em] text-brand">BVS Music</p>
      <h1 className="mt-2 text-4xl font-semibold md:text-5xl">Published artists</h1>
      <p className="mt-3 max-w-2xl text-text-secondary">
        Explore artists verified by BVS editorial and the music they have published on the platform.
      </p>
      {artists.length ? (
        <div className="mt-10 grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
          {artists.map((artist) => (
            <Link key={artist.id} href={`/artist/${artist.username}`} className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
              <div className="relative aspect-square overflow-hidden bg-black/40">
                <Image src={artist.image} alt={artist.name} fill unoptimized={/^https?:\/\//i.test(artist.image)} sizes="(max-width:768px) 50vw, 25vw" className="object-cover object-center transition duration-300 group-hover:scale-[1.04]" />
              </div>
              <div className="p-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-brand">Verified {artist.role}</p>
                <h2 className="mt-1 truncate text-xl font-semibold group-hover:text-brand">{artist.name}</h2>
                <p className="mt-1 text-sm text-text-secondary">{artist.trackCount} published {artist.trackCount === 1 ? 'track' : 'tracks'}</p>
                {artist.genres.length > 0 && <p className="mt-2 truncate text-xs text-text-secondary">{artist.genres.join(' · ')}</p>}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-10 rounded-2xl border border-dashed border-white/15 p-10 text-center">
          <h2 className="text-xl">No artist profiles are published yet</h2>
          <p className="mt-2 text-text-secondary">Profiles will appear here after BVS editorial verification.</p>
        </div>
      )}
    </main>
  )
}
