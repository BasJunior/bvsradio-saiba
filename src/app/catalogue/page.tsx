'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'

// Mock data for demo (expand with real Supabase later)
const mockTracks = [
  { 
    id: 1, 
    title: "Harare Nights", 
    artist: "BVS Collective", 
    genre: "Afrobeats", 
    plays: 124000, 
    artwork: "/images/festival-crowd.jpg",
    album: "Zimbabwe Nights",
    duration: "3:42",
    description: "A vibrant celebration of Harare nightlife with infectious rhythms and soulful vocals.",
    type: "song",
    price: 1.99
  },
  { 
    id: 2, 
    title: "Vibrations", 
    artist: "Wolf Bridges feat. Local Artist", 
    genre: "Hip-Hop", 
    plays: 89000, 
    artwork: "/images/musicians.jpg",
    album: "Urban Echoes",
    duration: "4:15",
    description: "Powerful hip-hop track blending modern beats with traditional Zimbabwean elements.",
    type: "song",
    price: 1.99
  },
  { 
    id: 3, 
    title: "Shona Soul", 
    artist: "BVS Artists", 
    genre: "Afrobeats", 
    plays: 156000, 
    artwork: "/images/hero-studio.jpg",
    album: "Zimbabwe Nights",
    duration: "5:01",
    description: "Soul-stirring Afrobeats anthem rooted in Shona heritage.",
    type: "song",
    price: 1.99
  },
  { 
    id: 4, 
    title: "City Lights", 
    artist: "BVS Collective", 
    genre: "Electronic", 
    plays: 67000, 
    artwork: "/images/female-host.jpg",
    album: "Urban Echoes",
    duration: "3:28",
    description: "Electronic vibes capturing the energy of African cities at night.",
    type: "song",
    price: 1.99
  },
  {
    id: 5,
    title: "Midnight Drive Beat",
    artist: "BVS Producers",
    genre: "Hip-Hop",
    plays: 45000,
    artwork: "/images/musicians.jpg",
    album: "Producer Essentials",
    duration: "2:55",
    description: "Hard-hitting custom beat perfect for rap or Afrobeats flows.",
    type: "beat",
    price: 29.99
  },
  {
    id: 6,
    title: "Behind the Sound: BVS Origins",
    artist: "BVS Radio",
    genre: "Podcast",
    plays: 32000,
    artwork: "/images/hero-studio.jpg",
    album: "BVS Podcast",
    duration: "28:40",
    description: "Deep dive into how BVS Radio and its artists are shaping Zimbabwe's sound.",
    type: "podcast",
    price: 4.99
  },
  {
    id: 7,
    title: "Live at BVS Studios - Visual Set",
    artist: "BVS Collective",
    genre: "Video",
    plays: 21000,
    artwork: "/images/festival-crowd.jpg",
    album: "Live Sessions",
    duration: "12:15",
    description: "Full live performance video with multi-cam. Exclusive visual experience.",
    type: "video",
    price: 9.99
  }
]

// Mock albums
const albums = {
  "Zimbabwe Nights": mockTracks.filter(t => t.album === "Zimbabwe Nights"),
  "Urban Echoes": mockTracks.filter(t => t.album === "Urban Echoes"),
  "Producer Essentials": mockTracks.filter(t => t.album === "Producer Essentials")
}

interface Track {
  id: number;
  title: string;
  artist: string;
  genre: string;
  plays: number;
  artwork: string;
  album: string;
  duration: string;
  description: string;
  type: string;
  price: number;
}

export default function CataloguePage() {
  const [search, setSearch] = useState('')
  const [genreFilter, setGenreFilter] = useState('All')
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null)
  const [purchasedItems, setPurchasedItems] = useState<number[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentPlayingTrack, setCurrentPlayingTrack] = useState<Track | null>(null)
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)
  const [oscillator, setOscillator] = useState<OscillatorNode | null>(null)
  const [gainNode, setGainNode] = useState<GainNode | null>(null)
  const [cart, setCart] = useState<Track[]>([])

  // Persistent purchases with localStorage
  useEffect(() => {
    const saved = localStorage.getItem('bvs_purchased_items')
    if (saved) {
      setPurchasedItems(JSON.parse(saved))
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('bvs_purchased_items', JSON.stringify(purchasedItems))
  }, [purchasedItems])

  // Persist cart
  useEffect(() => {
    const savedCart = localStorage.getItem('bvs_cart')
    if (savedCart) setCart(JSON.parse(savedCart))
  }, [])

  useEffect(() => {
    localStorage.setItem('bvs_cart', JSON.stringify(cart))
  }, [cart])

  const filtered = mockTracks.filter(track => {
    const matchesSearch = track.title.toLowerCase().includes(search.toLowerCase()) || 
                         track.artist.toLowerCase().includes(search.toLowerCase())
    const matchesGenre = genreFilter === 'All' || track.genre === genreFilter
    return matchesSearch && matchesGenre
  })

  const genres = ['All', ...Array.from(new Set(mockTracks.map(t => t.genre)))]

  // Real audio playback using Web Audio API (demo synth for music feel)
  const playTrack = (track: Track) => {
    if (currentPlayingTrack?.id === track.id && isPlaying) {
      stopPlayback()
      return
    }

    stopPlayback()

    const ctx = audioContext || new (window.AudioContext || (window as any).webkitAudioContext)()
    if (!audioContext) setAudioContext(ctx)

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const filter = ctx.createBiquadFilter()

    // Different sounds based on genre for demo feel
    if (track.genre === 'Afrobeats') {
      osc.type = 'sawtooth'
      osc.frequency.value = 220
      filter.type = 'lowpass'
      filter.frequency.value = 800
    } else if (track.genre === 'Hip-Hop') {
      osc.type = 'square'
      osc.frequency.value = 180
    } else if (track.genre === 'Electronic') {
      osc.type = 'sine'
      osc.frequency.value = 440
    } else {
      osc.type = 'triangle'
      osc.frequency.value = 300
    }

    gain.gain.value = 0.3

    const lfo = ctx.createOscillator()
    const lfoGain = ctx.createGain()
    lfo.type = 'sine'
    lfo.frequency.value = 6
    lfoGain.gain.value = 20

    lfo.connect(lfoGain)
    lfoGain.connect(osc.frequency)
    lfo.start()

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)

    osc.start()

    setAudioContext(ctx)
    setOscillator(osc)
    setGainNode(gain)
    setCurrentPlayingTrack(track)
    setIsPlaying(true)

    // Auto stop after duration simulation
    setTimeout(() => {
      if (currentPlayingTrack?.id === track.id) {
        stopPlayback()
      }
    }, 8000) // 8 seconds demo
  }

  const stopPlayback = () => {
    if (oscillator) {
      oscillator.stop()
      setOscillator(null)
    }
    if (gainNode) {
      setGainNode(null)
    }
    setIsPlaying(false)
    setCurrentPlayingTrack(null)
  }

  const openDetails = (track: Track) => {
    setSelectedTrack(track)
    if (isPlaying && currentPlayingTrack?.id === track.id) {
      // keep playing
    } else {
      stopPlayback()
    }
  }

  const closeDetails = () => {
    setSelectedTrack(null)
  }

  const purchaseItem = (track: Track) => {
    if (purchasedItems.includes(track.id)) {
      downloadItem(track)
      return
    }

    // Actual checkout simulation
    const proceed = window.confirm(
      `Checkout for "${track.title}" by ${track.artist}\n\nPrice: $${track.price}\n\nProceed to payment?`
    )

    if (!proceed) return

    // Fake payment form simulation
    const cardNumber = prompt('Enter test card number (4242 4242 4242 4242):', '4242 4242 4242 4242')
    if (!cardNumber) return

    const expiry = prompt('Expiry (MM/YY):', '12/28')
    if (!expiry) return

    // Simulate processing
    setTimeout(() => {
      setPurchasedItems([...purchasedItems, track.id])
      alert(`Payment successful. Your ${track.type} is ready.`)
      setTimeout(() => downloadItem(track), 300)
    }, 800)
  }

  const addToCart = (track: Track) => {
    if (cart.find(item => item.id === track.id)) {
      alert('Already in cart!')
      return
    }
    setCart([...cart, track])
    alert(`Added "${track.title}" to cart.`)
  }

  const downloadItem = (track: Track) => {
    const ext = track.type === 'beat' ? 'wav' : track.type === 'video' ? 'mp4' : track.type === 'podcast' ? 'mp3' : 'mp3'
    const fileName = `${track.title.replace(/\s+/g, '_')}_BVS.${ext}`
    
    // Create a realistic placeholder download 
    const content = `BVS Radio - ${track.title}
Artist: ${track.artist}
Album: ${track.album}
Type: ${track.type.toUpperCase()}
Duration: ${track.duration}
Price Paid: $${track.price}

Thank you for your purchase from BVS Radio (Best Virtual Sound).

In production, this would be the actual high-quality file.
File ready for download.

Visit bvsradio.com for more music and services by Wolf Bridges.`

    const blob = new Blob([content], { type: track.type === 'video' ? 'video/mp4' : 'audio/mpeg' })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    alert(`Downloading ${fileName} (demo file)`)
  }

  const currentAlbumTracks = selectedTrack ? (albums[selectedTrack.album as keyof typeof albums] || []) : []

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Browse Music</h1>
        <p className="text-text-secondary">Discover sounds from BVS artists. Play, save, and support the culture — Spotify style.</p>
      </div>

      {/* Spotify-like controls */}
      <div className="flex flex-col md:flex-row gap-4 mb-8 items-center">
        <input
          type="text"
          placeholder="Search tracks or artists..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-bg-card border border-white/10 rounded-full px-5 py-3 focus:outline-none focus:border-brand"
        />
        <select 
          value={genreFilter} 
          onChange={(e) => setGenreFilter(e.target.value)}
          className="bg-bg-card border border-white/10 rounded-full px-5 py-3 focus:outline-none focus:border-brand"
        >
          {genres.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <button 
          onClick={() => {
            if (cart.length === 0) alert('Cart is empty. Add items from track details.')
            else window.location.href = '/shop?cart=true'
          }}
          className="px-4 py-2 bg-brand text-black rounded-full text-sm font-semibold flex items-center gap-2 hover:bg-brand-dark"
        >
          Cart ({cart.length})
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {filtered.length > 0 ? filtered.map(track => (
          <div 
            key={track.id} 
            className="group bg-bg-card/50 rounded-2xl overflow-hidden border border-white/10 hover:border-brand/30 transition cursor-pointer"
            onClick={() => playTrack(track)}
            onDoubleClick={() => openDetails(track)}
          >
            <div className="relative aspect-square">
              <Image src={track.artwork} alt={track.title} fill className="object-cover" />
              <button 
                onClick={(e) => { e.stopPropagation(); playTrack(track); }}
                className="absolute bottom-3 right-3 w-12 h-12 bg-brand rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-lg hover:scale-105"
              >
                ▶
              </button>
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between mb-1">
                <h3 className="font-semibold text-[15px] truncate leading-tight pr-2">{track.title}</h3>
                <span className="text-[10px] px-1.5 py-px bg-brand/10 text-brand rounded tracking-widest flex-shrink-0">HiFi</span>
              </div>
              <Link href={`/artist/${encodeURIComponent(track.artist.toLowerCase().replace(/\s+/g, '-'))}`} className="text-sm text-text-secondary truncate hover:text-brand hover:underline block mb-2">{track.artist}</Link>
              <div className="flex items-center justify-between text-xs text-text-secondary">
                <span>{track.genre}</span>
                <span>{Math.round(track.plays / 1000)}k</span>
              </div>
            </div>
          </div>
        )) : (
          <p className="col-span-full text-center text-text-secondary py-12">No tracks found. Try different search.</p>
        )}
      </div>

      <div className="mt-12 text-center">
        <Link href="/radio" className="text-brand hover:underline">Go to full Radio player</Link>
        <span className="mx-3 text-text-secondary">·</span>
        <Link href="/shop" className="text-brand hover:underline">Get HiFi mastering by Wolf Bridges</Link>
      </div>

      {/* Playlists - Tidal inspired discovery */}
      <div className="mt-16 pt-10 border-t border-white/10">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold tracking-tight">Playlists</h3>
          <Link href="/catalogue" className="text-sm text-brand">Explore all</Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {[
            { name: "BVS Radio Essentials", tracks: "42 tracks", img: "/images/hero-studio.jpg" },
            { name: "Wolf Bridges Mastered", tracks: "28 tracks", img: "/images/musicians.jpg" },
            { name: "New Zimbabwe", tracks: "15 tracks", img: "/images/festival-crowd.jpg" },
            { name: "Late Night Afrobeats", tracks: "67 tracks", img: "/images/female-host.jpg" },
            { name: "Producer Picks", tracks: "34 tracks", img: "/images/hero-studio.jpg" },
          ].map((pl, i) => (
            <Link key={i} href="/catalogue" className="group">
              <div className="aspect-square rounded-xl overflow-hidden mb-2 border border-white/5 relative">
                <Image src={pl.img} alt={pl.name} fill className="object-cover group-hover:scale-[1.015] transition" />
              </div>
              <div className="text-sm font-medium">{pl.name}</div>
              <div className="text-xs text-text-secondary">{pl.tracks}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Videos - Tidal style */}
      <div className="mt-10">
        <h3 className="font-semibold tracking-tight mb-6">Videos</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {mockTracks.filter(t => t.type === 'video' || t.genre === 'Video').length > 0 ? (
            mockTracks.filter(t => t.type === 'video' || t.genre === 'Video').map((v, i) => (
              <Link key={i} href="/catalogue" className="group block">
                <div className="relative aspect-video rounded-xl overflow-hidden mb-2 border border-white/5">
                  <Image src={v.artwork} alt={v.title} fill className="object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center text-black">▶</div>
                  </div>
                </div>
                <div className="text-sm font-medium">{v.title}</div>
                <div className="text-xs text-text-secondary">{v.artist} • {v.duration}</div>
              </Link>
            ))
          ) : (
            <div className="text-sm text-text-secondary col-span-full">Music videos and visual content coming soon.</div>
          )}
        </div>
      </div>

      {/* Mini Now Playing bar for real playback */}
      {isPlaying && currentPlayingTrack && (
        <div className="fixed bottom-0 left-0 right-0 bg-black/95 border-t border-white/20 p-4 z-50 flex items-center justify-between text-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded overflow-hidden">
              <Image src={currentPlayingTrack.artwork} alt="" width={40} height={40} className="object-cover" />
            </div>
            <div>
              <div className="font-medium">{currentPlayingTrack.title}</div>
              <div className="text-xs text-text-secondary">{currentPlayingTrack.artist}</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-brand">Now playing</div>
            <Link href="/radio" className="text-xs px-3 py-1 border border-white/20 rounded hover:bg-white/5">Open full Radio</Link>
            <button onClick={stopPlayback} className="px-4 py-1 bg-white/10 rounded hover:bg-white/20">Stop</button>
          </div>
        </div>
      )}

      {/* Track Details Modal - intuitive details view */}
      {selectedTrack && (
        <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4" onClick={closeDetails}>
          <div 
            className="bg-bg-primary max-w-4xl w-full rounded-3xl overflow-hidden border border-white/10 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex flex-col md:flex-row">
              {/* Album Art */}
              <div className="md:w-1/2 relative aspect-square md:aspect-auto">
                <Image 
                  src={selectedTrack.artwork} 
                  alt={selectedTrack.title} 
                  fill 
                  className="object-cover" 
                />
                <button 
                  onClick={closeDetails}
                  className="absolute top-4 right-4 text-white bg-black/50 rounded-full w-10 h-10 flex items-center justify-center hover:bg-black/70"
                >
                  ✕
                </button>
              </div>

              {/* Details */}
              <div className="md:w-1/2 p-8 flex flex-col">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="uppercase text-xs tracking-[2px] text-brand">{selectedTrack.genre}</div>
                    <div className="text-[10px] px-1.5 py-px bg-brand/10 text-brand rounded tracking-widest">HiFi • Lossless</div>
                  </div>
                  <h2 className="text-4xl font-bold mb-1">{selectedTrack.title}</h2>
                  <p className="text-2xl text-text-secondary mb-1">{selectedTrack.artist}</p>
                  <p className="text-sm text-text-secondary mb-4">{selectedTrack.album} • {selectedTrack.duration}</p>
                  
                  <p className="text-text-secondary leading-relaxed mb-4">{selectedTrack.description}</p>

                  <div className="mb-6">
                    <button onClick={() => alert('Added to a playlist (demo)')} className="text-sm text-brand hover:underline">+ Add to playlist</button>
                  </div>
                </div>

                {/* Album Tracks */}
                <div className="mb-6">
                  <h4 className="font-semibold mb-3 text-sm uppercase tracking-widest">From the album</h4>
                  <div className="space-y-1 text-sm">
                    {currentAlbumTracks.length > 0 ? currentAlbumTracks.map((t, idx) => (
                      <div 
                        key={idx} 
                        className={`flex justify-between p-2 rounded hover:bg-white/5 ${t.id === selectedTrack.id ? 'bg-brand/10 text-brand' : ''}`}
                        onClick={() => setSelectedTrack(t as any)}
                      >
                        <span>{t.title}</span>
                        <span className="text-text-secondary">{t.duration}</span>
                      </div>
                    )) : (
                      <div className="text-text-secondary">Other tracks from this album would appear here.</div>
                    )}
                  </div>
                </div>

                {/* Actions - Purchase & Download */}
                <div className="mt-auto pt-6 border-t border-white/10">
                  <div className="flex gap-3 mb-4">
                    <button 
                      onClick={() => playTrack(selectedTrack)}
                      className="flex-1 py-3 bg-brand text-black font-semibold rounded-full hover:bg-brand-dark flex items-center justify-center gap-2"
                    >
                      {isPlaying && currentPlayingTrack?.id === selectedTrack.id ? '⏸ Pause' : '▶ Play'}
                    </button>
                    <button 
                      onClick={() => addToCart(selectedTrack)}
                      className="flex-1 py-3 border border-white/30 hover:bg-white/5 rounded-full font-semibold"
                    >
                      Add to Cart
                    </button>
                    <button 
                      onClick={() => purchaseItem(selectedTrack)}
                      className="flex-1 py-3 bg-brand/20 text-brand rounded-full font-semibold hover:bg-brand/30"
                    >
                      {purchasedItems.includes(selectedTrack.id) ? 'Download' : `Buy Now $${selectedTrack.price}`}
                    </button>
                  </div>

                  <Link 
                    href="/shop" 
                    className="block text-center text-sm text-brand hover:underline mb-2"
                  >
                    Get this mastered by Wolf Bridges
                  </Link>

                  {selectedTrack.type === 'beat' && (
                    <button 
                      onClick={() => {
                        alert('Added beat to cart. In full version this would go to checkout.')
                        purchaseItem(selectedTrack)
                      }}
                      className="w-full py-2 text-sm text-brand hover:underline"
                    >
                      Or purchase as custom beat (see full shop)
                    </button>
                  )}

                  <div className="text-[10px] text-center text-text-secondary mt-4">
                    Double-tap or click outside to close • Purchase unlocks instant download
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
