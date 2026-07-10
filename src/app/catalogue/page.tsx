import { createServerSupabaseClient } from '@/lib/supabase'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function CataloguePage() {
  const supabase = await createServerSupabaseClient()
  const { data: tracks } = await supabase
    .from('tracks')
    .select('*, profiles(*)')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-bold mb-3">Music Catalogue</h1>
        <p className="text-text-secondary text-lg">
          Discover tracks from Zimbabwean and African artists.
        </p>
      </div>

      {!tracks || tracks.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-bg-card rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">No tracks yet</h2>
          <p className="text-text-secondary mb-6">Be the first artist to upload your music!</p>
          <Link
            href="/upload"
            className="px-6 py-3 bg-brand text-black font-semibold rounded-full hover:bg-brand-dark transition-all inline-block"
          >
            Upload Your Music
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {tracks.map((track) => (
            <div
              key={track.id}
              className="bg-bg-card/50 backdrop-blur rounded-xl border border-white/10 overflow-hidden group hover:border-brand/30 transition-all"
            >
              <div className="aspect-square bg-gradient-to-br from-brand/20 to-accent/20 relative overflow-hidden">
                {track.artwork_url && track.artwork_url !== '/assets/images/default-artwork.jpg' ? (
                  <img src={track.artwork_url} alt={track.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-16 h-16 text-brand/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button className="w-14 h-14 bg-brand rounded-full flex items-center justify-center text-black hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold truncate">{track.title}</h3>
                <p className="text-sm text-text-secondary truncate">
                  {track.profiles?.display_name || track.artist_name || 'Unknown Artist'}
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs text-text-secondary">
                  <span className="px-2 py-0.5 bg-white/5 rounded-full">{track.genre}</span>
                  <span>{track.play_count || 0} plays</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}