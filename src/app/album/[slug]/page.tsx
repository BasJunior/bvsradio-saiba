'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

// Reuse mock from catalogue concept
const allTracks = [
  { id: 1, title: "Harare Nights", artist: "BVS Collective", genre: "Afrobeats", album: "Zimbabwe Nights", duration: "3:42", artwork: "/images/festival-crowd.jpg", price: 1.99, type: "song" },
  { id: 3, title: "Shona Soul", artist: "BVS Artists", genre: "Afrobeats", album: "Zimbabwe Nights", duration: "5:01", artwork: "/images/hero-studio.jpg", price: 1.99, type: "song" },
  { id: 2, title: "Vibrations", artist: "Wolf Bridges feat. Local Artist", genre: "Hip-Hop", album: "Urban Echoes", duration: "4:15", artwork: "/images/musicians.jpg", price: 1.99, type: "song" },
  { id: 4, title: "City Lights", artist: "BVS Collective", genre: "Electronic", album: "Urban Echoes", duration: "3:28", artwork: "/images/female-host.jpg", price: 1.99, type: "song" },
  { id: 5, title: "Midnight Drive Beat", artist: "BVS Producers", genre: "Hip-Hop", album: "Producer Essentials", duration: "2:55", artwork: "/images/musicians.jpg", price: 29.99, type: "beat" },
]

export default function AlbumPage() {
  const params = useParams()
  const slug = params.slug as string
  const albumName = decodeURIComponent(slug).replace(/-/g, ' ')
  
  const albumTracks = allTracks.filter(t => t.album.toLowerCase() === albumName.toLowerCase())
  
  if (albumTracks.length === 0) {
    return <div className="p-12 text-center">Album not found. <Link href="/catalogue">Back to browse</Link></div>
  }

  const mainTrack = albumTracks[0]

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <Link href="/catalogue" className="text-sm text-brand hover:underline">← Back to Browse</Link>
      
      <div className="mt-8 flex flex-col md:flex-row gap-8">
        <div className="w-full md:w-1/3">
          <div className="aspect-square rounded-2xl overflow-hidden border border-white/10">
            <Image src={mainTrack.artwork} alt={albumName} width={500} height={500} className="object-cover" />
          </div>
        </div>
        
        <div className="flex-1">
          <div className="uppercase text-xs tracking-[2px] text-brand mb-1">ALBUM</div>
          <h1 className="text-5xl font-bold tracking-tight mb-2">{albumName}</h1>
          <p className="text-2xl text-text-secondary mb-6">{mainTrack.artist}</p>
          
          <div className="mb-8">
            <h3 className="font-semibold mb-3">Tracks</h3>
            <div className="space-y-2">
              {albumTracks.map((track, i) => (
                <div key={i} className="flex justify-between items-center p-3 bg-bg-card/50 rounded-xl hover:bg-bg-card/70">
                  <div>
                    <div className="font-medium">{track.title}</div>
                    <div className="text-xs text-text-secondary">{track.duration} • {track.genre}</div>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/catalogue`} className="text-xs px-3 py-1 border border-white/20 rounded-full">Play</Link>
                    <button onClick={() => alert(`Purchased ${track.title} for $${track.price}. Download would start.`)} className="text-xs px-3 py-1 bg-brand text-black rounded-full">Buy $${track.price}</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <Link href="/shop" className="inline-block px-6 py-3 bg-brand text-black rounded-full font-semibold">Get this album mastered by Wolf Bridges</Link>
        </div>
      </div>
    </div>
  )
}
