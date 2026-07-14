'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

const artistData: Record<string, any> = {
  "bvs-collective": {
    name: "BVS Collective",
    bio: "Flagship group representing the sound of modern Zimbabwe. Blending traditional elements with contemporary production.",
    image: "/images/festival-crowd.jpg",
    tracks: [
      { title: "Harare Nights", plays: 124000, album: "Zimbabwe Nights" },
      { title: "City Lights", plays: 67000, album: "Urban Echoes" }
    ],
    servicesUsed: ["Mixing by Wolf Bridges", "Mastering", "Custom Beat Commission"]
  },
  "wolf-bridges": {
    name: "Wolf Bridges",
    bio: "Lead engineer and occasional artist. Known for warm, powerful mixes that have powered millions of streams.",
    image: "/images/musicians.jpg",
    tracks: [
      { title: "Vibrations", plays: 89000, album: "Urban Echoes" }
    ],
    servicesUsed: ["Engineering", "Production"]
  },
  "bvs-artists": {
    name: "BVS Artists",
    bio: "Collective of emerging voices from across Zimbabwe.",
    image: "/images/hero-studio.jpg",
    tracks: [
      { title: "Shona Soul", plays: 156000, album: "Zimbabwe Nights" }
    ],
    servicesUsed: ["Full Album Mastering", "Playlist Pitching"]
  }
}

export default function ArtistPage() {
  const params = useParams()
  const slug = params.slug as string
  const artistKey = slug.toLowerCase().replace(/-/g, ' ')
  
  const artist = Object.values(artistData).find(a => a.name.toLowerCase().includes(artistKey.split(' ')[0])) || artistData["bvs-collective"]

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <Link href="/catalogue" className="text-sm text-brand">← Back to music</Link>
      
      <div className="mt-8 flex flex-col md:flex-row gap-10">
        <div className="md:w-1/3">
          <Image src={artist.image} alt={artist.name} width={400} height={400} className="rounded-2xl" />
        </div>
        
        <div className="flex-1">
          <h1 className="text-5xl font-bold mb-2">{artist.name}</h1>
          <p className="text-text-secondary mb-8 max-w-prose">{artist.bio}</p>
          
          <div className="mb-10">
            <h3 className="uppercase text-xs tracking-widest text-brand mb-3">Tracks on BVS Radio</h3>
            {artist.tracks.map((t: any, i: number) => (
              <div key={i} className="py-2 border-b border-white/10 flex justify-between text-sm">
                <span>{t.title} — {t.album}</span>
                <span className="text-text-secondary">{Math.round(t.plays/1000)}k plays</span>
              </div>
            ))}
          </div>

          <div>
            <h3 className="uppercase text-xs tracking-widest text-brand mb-3">Services Used</h3>
            <div className="flex flex-wrap gap-2">
              {artist.servicesUsed.map((s: string, i: number) => (
                <Link key={i} href="/shop" className="px-4 py-1 bg-white/5 rounded-full text-sm hover:bg-brand/20">{s}</Link>
              ))}
            </div>
            <Link href="/shop" className="block mt-4 text-sm text-brand hover:underline">Book services with Wolf Bridges or team</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
