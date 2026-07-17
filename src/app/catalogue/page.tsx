'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

type TrackType = 'single' | 'beat' | 'mix'

interface Track {
  id: number
  title: string
  artist: string
  genre: string
  collection: string
  duration: string
  description: string
  type: TrackType
  src: string
  artwork: string
  bpm?: string
  price?: number
}

const coverArt = '/music/Bvs-3000x3000%202.png'
const junePackArt = '/images/music-packs/june-pack.jpg'
const mayPackArt = '/images/music-packs/may-pack-1-2.jpg'
const previewLimitSeconds = 30

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const wholeSeconds = Math.floor(seconds)
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, '0')}`
}

function musicFile(filename: string) {
  return `/music/${encodeURIComponent(filename)}`
}

const tracks: Track[] = [
  {
    id: 1,
    title: 'Robert Gabriel Mugabe International Airport',
    artist: 'BVS Radio',
    genre: 'BVS Original',
    collection: 'BVS Archive',
    duration: '3:42',
    description: 'One of the preserved original BVS cuts now restored into the live site catalogue.',
    type: 'single',
    src: musicFile('1. RobertGabrielMugabeInternationalAirport.mp3'),
    artwork: coverArt,
  },
  {
    id: 2,
    title: 'BVS Slide',
    artist: 'BVS Radio',
    genre: 'BVS Original',
    collection: 'BVS Archive',
    duration: '3:18',
    description: 'A direct BVS archive track from the original player library.',
    type: 'mix',
    src: musicFile('2.BVSSlidemix1.mp3'),
    artwork: coverArt,
  },
  {
    id: 3,
    title: 'Never Ending Mix',
    artist: 'BVS x Brx',
    genre: 'BVS Original',
    collection: 'BVS Archive',
    duration: '4:08',
    description: 'BVS and Brx energy from the preserved VPS catalogue.',
    type: 'mix',
    src: musicFile('3. BrxBVSNeverEndingmix1.mp3'),
    artwork: coverArt,
  },
  {
    id: 4,
    title: 'BVS Starve',
    artist: 'BVS Radio',
    genre: 'BVS Original',
    collection: 'BVS Archive',
    duration: '3:36',
    description: 'A gritty BVS demo track carried forward from the original station files.',
    type: 'single',
    src: musicFile('4. BVSStarveDEMO1.mp3'),
    artwork: coverArt,
  },
  {
    id: 5,
    title: 'Calm Beast',
    artist: 'Mahendere',
    genre: 'Gospel',
    collection: 'BVS Archive',
    duration: '4:22',
    description: 'A mastered archive track that gives the catalogue a warmer Zimbabwean gospel edge.',
    type: 'single',
    src: musicFile('Calm Beast - Mahendere (MAST).mp3'),
    artwork: coverArt,
  },
  {
    id: 6,
    title: 'Mellisa',
    artist: 'WolfBrx',
    genre: 'Hip-Hop',
    collection: 'June Pack',
    duration: '2:54',
    description: 'A polished WolfBrx beat from the staged June pack.',
    type: 'beat',
    bpm: '156 BPM',
    src: musicFile('mellisa - 156 bpm @wolfbrx.mp3'),
    artwork: junePackArt,
  },
  {
    id: 7,
    title: 'In My City',
    artist: 'WolfBrx',
    genre: 'Hip-Hop',
    collection: 'June Pack',
    duration: '2:41',
    description: 'Fast, direct, and built for radio rotation or artist placement.',
    type: 'beat',
    bpm: '170 BPM',
    src: musicFile('in my city - 170 bpm @wolfbrx.mp3'),
    artwork: junePackArt,
  },
  {
    id: 8,
    title: 'RGB',
    artist: 'WolfBrx',
    genre: 'Trap',
    collection: 'June Pack',
    duration: '3:05',
    description: 'A clean trap beat with the kind of punch that fits BVS producer showcases.',
    type: 'beat',
    bpm: '160 BPM',
    src: musicFile('RGB - 160 bpm @wolfbrx.mp3'),
    artwork: junePackArt,
  },
  {
    id: 9,
    title: 'Fading Memories',
    artist: 'WolfBrx + Znayshi',
    genre: 'Melodic Rap',
    collection: 'March Pack',
    duration: '2:58',
    description: 'Melodic and reflective, pulled from the WolfBrx pack now sitting in the live catalogue.',
    type: 'beat',
    bpm: '167 BPM',
    src: musicFile('fading memories - 167 bpm @wolfbrx + znayshi.mp3'),
    artwork: '/images/mic-closeup.jpg',
  },
  {
    id: 10,
    title: 'The Giant',
    artist: 'WolfBrx + Dannynevamiss',
    genre: 'Hip-Hop',
    collection: 'March Pack',
    duration: '2:47',
    description: 'A heavy producer cut from the Dropbox pack with enough presence for a featured card.',
    type: 'beat',
    bpm: '166 BPM',
    src: musicFile('the giant - 166 bpm @wolfbrx + dannynevamiss.mp3'),
    artwork: '/images/musicians.jpg',
  },
  {
    id: 11,
    title: 'Foreign Exchange',
    artist: 'WolfBrx + Thermo',
    genre: 'Trap',
    collection: 'March Pack',
    duration: '3:11',
    description: 'A sharp, clean beat that fits the producer-market side of BVS.',
    type: 'beat',
    bpm: '158 BPM',
    src: musicFile('foreign exchange - 158 bpm @wolfbrx + thermo.mp3'),
    artwork: '/images/female-host.jpg',
  },
  {
    id: 12,
    title: 'Chiraq Drillaz',
    artist: 'WolfBrx',
    genre: 'Drill',
    collection: 'January Pack',
    duration: '2:51',
    description: 'Drill energy from the January pack, useful for showing the harder side of the catalogue.',
    type: 'beat',
    bpm: '158 BPM',
    src: musicFile('Chiraq Drillaz - 158 bpm @wolfbrx.mp3'),
    artwork: '/images/festival-crowd.jpg',
  },
  {
    id: 13,
    title: 'Bottom Barre',
    artist: 'WolfBrx + Prodbygtp',
    genre: 'Rap',
    collection: 'January Pack',
    duration: '3:02',
    description: 'A lower-tempo cut from the pack with a different pocket for artists browsing beats.',
    type: 'beat',
    bpm: '98 BPM',
    src: musicFile('bottom barre - 98 bpm @wolfbrx + prodbygtp.mp3'),
    artwork: '/images/hero-studio.jpg',
  },
  {
    id: 14,
    title: 'Rockstar',
    artist: 'WolfBrx + Jhawk',
    genre: 'Hip-Hop',
    collection: 'February Pack',
    duration: '2:45',
    description: 'A catchy, accessible WolfBrx collaboration from the February pack.',
    type: 'beat',
    bpm: '125 BPM',
    src: musicFile('rockstar - 125 bpm @wolfbrx + jhawk.mp3'),
    artwork: '/images/mic-closeup.jpg',
  },
  {
    id: 15,
    title: 'Grinder\'s Prayer',
    artist: 'WolfBrx',
    genre: 'Trap',
    collection: 'May Pack',
    duration: '3:00',
    description: 'A focused May pack track that fits the BVS working-artist lane.',
    type: 'beat',
    bpm: '169 BPM',
    src: musicFile("grinder's prayer - 169 bpm @wolfbrx.mp3"),
    artwork: mayPackArt,
  },
  {
    id: 16,
    title: 'Eternity',
    artist: 'WolfBrx',
    genre: 'Soul',
    collection: 'Naygifted Beats',
    duration: '2:39',
    description: 'A slower, soulful beat to balance the harder drill and trap rows.',
    type: 'beat',
    bpm: '90 BPM',
    src: musicFile('eternity - 90 bpm @wolfbrx.mp3'),
    artwork: '/images/female-host.jpg',
  },
  // Drive commerce products (ids match bvsradio-products/albums/<id>.zip)
  {
    id: 100,
    title: 'LORD Album',
    artist: 'CalmBeast x W.Hills',
    genre: 'Album',
    collection: 'Albums',
    duration: 'Full album',
    description:
      'Full LORD album download (CalmBeast x W.Hills). Preview uses a related Calm Beast master; full zip is fulfilled after payment.',
    type: 'mix',
    src: musicFile('Calm Beast - Mahendere (MAST).mp3'),
    artwork: '/images/albums/lord-album.jpg',
    price: 19,
  },
  {
    id: 101,
    title: 'Album 16 Bit',
    artist: 'BVS Radio',
    genre: 'Album',
    collection: 'Albums',
    duration: 'Full album',
    description:
      'Complete 16 Bit album package from the BVS product drop. Digital download after checkout confirmation.',
    type: 'mix',
    src: musicFile('calm-beast.mp3'),
    artwork: '/images/albums/album-16-bit.jpg',
    price: 14,
  },
]

const collectionCards = [
  { name: 'Albums', detail: 'Full album downloads', img: '/images/albums/lord-album.jpg' },
  { name: 'BVS Archive', detail: 'Original station tracks', img: coverArt },
  { name: 'June Pack', detail: 'WolfBrx radio-ready beats', img: junePackArt },
  { name: 'May Pack', detail: 'WolfBrx focused trap selections', img: mayPackArt },
  { name: 'March Pack', detail: 'Melodic and trap selections', img: '/images/mic-closeup.jpg' },
  { name: 'Producer Picks', detail: 'Beats ready for artists', img: '/images/hero-studio.jpg' },
]

function trackPrice(track: Track) {
  if (track.price !== undefined) {
    return track.price
  }

  if (track.type === 'beat') {
    return 29
  }

  if (track.type === 'mix') {
    return 4
  }

  return 2
}

function offerLabel(track: Track) {
  return track.type === 'beat' ? 'Beat licence' : track.type === 'mix' ? 'Archive download' : 'Track download'
}

function rightsSummary(track: Track) {
  if (track.type === 'beat') {
    return 'The listed price is a standard licence starting point. Usage limits, files supplied, credits and commercial release terms must be confirmed by BVS before release.'
  }

  return 'Personal listening download. Copyright and reuse rights remain with the rights holder; this purchase does not grant sampling, sync or redistribution rights.'
}

export default function CataloguePage() {
  const [search, setSearch] = useState(() => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('q') || ''
  })
  const [genreFilter, setGenreFilter] = useState('All')
  const [typeFilter, setTypeFilter] = useState<'all' | TrackType>(() => {
    if (typeof window === 'undefined') return 'all'
    const requestedType = new URLSearchParams(window.location.search).get('type')
    return requestedType === 'single' || requestedType === 'beat' || requestedType === 'mix' ? requestedType : 'all'
  })
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null)
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [previewElapsed, setPreviewElapsed] = useState(0)
  const [previewDuration, setPreviewDuration] = useState(previewLimitSeconds)
  const [cart, setCart] = useState<Track[]>(() => {
    if (typeof window === 'undefined') {
      return []
    }

    const savedCart = window.localStorage.getItem('bvs_cart')
    if (!savedCart) return []
    try {
      return JSON.parse(savedCart)
    } catch {
      return []
    }
  })
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    localStorage.setItem('bvs_cart', JSON.stringify(cart))
  }, [cart])

  useEffect(() => {
    return () => {
      audioRef.current?.pause()
    }
  }, [])

  const genres = useMemo(() => ['All', ...Array.from(new Set(tracks.map((track) => track.genre)))], [])

  const filteredTracks = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return tracks.filter((track) => {
      const matchesSearch =
        !normalizedSearch ||
        [track.title, track.artist, track.collection, track.genre].some((field) =>
          field.toLowerCase().includes(normalizedSearch),
        )

      const matchesGenre = genreFilter === 'All' || track.genre === genreFilter
      const matchesType = typeFilter === 'all' || track.type === typeFilter
      return matchesSearch && matchesGenre && matchesType
    })
  }, [genreFilter, search, typeFilter])

  const previewTrack = (track: Track) => {
    if (currentTrack?.id === track.id && isPlaying) {
      audioRef.current?.pause()
      setIsPlaying(false)
      return
    }

    audioRef.current?.pause()
    const audio = new Audio(track.src)
    audioRef.current = audio
    setCurrentTrack(track)
    setIsPlaying(true)
    setPreviewElapsed(0)
    setPreviewDuration(previewLimitSeconds)

    audio.addEventListener('loadedmetadata', () => {
      setPreviewDuration(Math.min(audio.duration || previewLimitSeconds, previewLimitSeconds))
    })

    audio.addEventListener('timeupdate', () => {
      const snippetDuration = Math.min(audio.duration || previewLimitSeconds, previewLimitSeconds)
      const elapsed = Math.min(audio.currentTime, snippetDuration)
      setPreviewElapsed(elapsed)
      setPreviewDuration(snippetDuration)

      if (audio.currentTime >= snippetDuration) {
        audio.pause()
        audio.currentTime = snippetDuration
        setPreviewElapsed(snippetDuration)
        setIsPlaying(false)
      }
    })

    audio.addEventListener('ended', () => {
      setIsPlaying(false)
      setPreviewElapsed(Math.min(audio.duration || previewLimitSeconds, previewLimitSeconds))
    })

    audio.play().catch(() => {
      setIsPlaying(false)
      setCurrentTrack(null)
    })
  }

  const stopPreview = () => {
    audioRef.current?.pause()
    setIsPlaying(false)
    setCurrentTrack(null)
    setPreviewElapsed(0)
  }

  const addToCart = (track: Track) => {
    if (cart.some((item) => item.id === track.id)) {
      return
    }

    setCart([...cart, { ...track, price: trackPrice(track) }])
  }

  const collectionTracks = selectedTrack
    ? tracks.filter((track) => track.collection === selectedTrack.collection)
    : []

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 pb-28">
      <section className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-end mb-10">
        <div>
          <p className="text-xs tracking-[3px] text-brand uppercase mb-3">BVS Catalogue</p>
          <h1 className="text-5xl font-semibold mb-4">Real tracks from the BVS library.</h1>
          <p className="max-w-2xl text-text-secondary text-lg">
            Preview available BVS archive audio and producer packs. Product labels make clear whether you are buying a personal download or starting a beat-licensing order.
          </p>
        </div>

        <div className="relative aspect-[16/10] rounded-2xl overflow-hidden border border-white/10">
          <Image src="/images/mic-closeup.jpg" alt="BVS Radio studio microphone" fill className="object-cover" priority />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4">
            <div>
              <div className="text-3xl font-semibold">{tracks.length}</div>
              <div className="text-sm text-text-secondary">featured cuts</div>
            </div>
            <Link href="/radio" className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-brand">
              Open Radio
            </Link>
          </div>
        </div>
      </section>

      <section className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {collectionCards.map((collection) => (
          <button
            type="button"
            key={collection.name}
            onClick={() => {
              setSearch(collection.name)
              setGenreFilter('All')
            }}
            className="group flex items-center gap-3 rounded-xl border border-white/10 bg-bg-card/40 p-3 text-left hover:border-brand/40"
          >
            <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg">
              <Image src={collection.img} alt="" fill className="object-cover group-hover:scale-[1.03] transition-transform" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{collection.name}</div>
              <div className="truncate text-xs text-text-secondary">{collection.detail}</div>
            </div>
          </button>
        ))}
      </section>

      <section id="browse" className="scroll-mt-24">
        <div className="mb-5 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-3 shadow-2xl shadow-black/20 md:p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <label className="group relative min-w-0 flex-1">
          <span className="sr-only">Search the BVS catalogue</span>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-text-secondary transition group-focus-within:text-brand">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            placeholder="Search tracks, artists, genres or packs"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/35 py-3.5 pl-13 pr-12 text-sm outline-none transition placeholder:text-white/35 hover:border-white/20 focus:border-brand focus:ring-4 focus:ring-brand/10"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-xs text-text-secondary hover:bg-white/10 hover:text-white">Clear</button>
          )}
        </label>
        <select
          value={genreFilter}
          onChange={(event) => setGenreFilter(event.target.value)}
          className="rounded-xl border border-white/10 bg-black/35 px-4 py-3.5 text-sm outline-none focus:border-brand"
        >
          {genres.map((genre) => (
            <option key={genre} value={genre}>
              {genre}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as 'all' | TrackType)}
          aria-label="Filter by content type"
          className="rounded-xl border border-white/10 bg-black/35 px-4 py-3.5 text-sm outline-none focus:border-brand"
        >
          <option value="all">All content</option>
          <option value="single">Track downloads</option>
          <option value="mix">Archive downloads</option>
          <option value="beat">Beat licences</option>
        </select>
        <Link href="/checkout" className="rounded-xl bg-brand px-5 py-3.5 text-center text-sm font-semibold text-black shadow-lg shadow-brand/10 hover:bg-brand-light">
          View cart · {cart.length}
        </Link>
        </div>
        </div>
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[2px] text-brand">BVS catalogue</p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight">{search ? `Results for “${search}”` : 'Browse all music'}</h2>
          </div>
          <span className="flex-shrink-0 text-sm text-text-secondary">{filteredTracks.length} {filteredTracks.length === 1 ? 'result' : 'results'}</span>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {filteredTracks.map((track) => {
          const active = currentTrack?.id === track.id && isPlaying

          return (
            <article
              key={track.id}
              className="group overflow-hidden rounded-2xl border border-white/10 bg-bg-card/45 transition hover:border-brand/40"
            >
              <button type="button" onClick={() => setSelectedTrack(track)} className="block w-full text-left">
                <div className="relative aspect-square overflow-hidden">
                  <Image src={track.artwork} alt={track.title} fill className="object-cover transition duration-300 group-hover:scale-[1.02]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80" />
                  <span className="absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-[10px] uppercase tracking-[1.5px] text-white">
                    {offerLabel(track)}
                  </span>
                </div>
              </button>

              <div className="p-4">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <h2 className="min-w-0 truncate text-[15px] font-semibold leading-tight">{track.title}</h2>
                  <span className="flex-shrink-0 rounded bg-brand/10 px-1.5 py-px text-[10px] tracking-widest text-brand">HiFi</span>
                </div>
                <p className="truncate text-sm text-text-secondary">{track.artist}</p>
                <div className="mt-3 flex items-center justify-between gap-2 text-xs text-text-secondary">
                  <span className="truncate">{track.genre}</span>
                  <span className="flex-shrink-0">{track.type === 'beat' ? 'from ' : ''}${trackPrice(track)}</span>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => previewTrack(track)}
                    className="flex-1 rounded-full bg-brand px-3 py-2 text-xs font-semibold text-black hover:bg-brand-dark"
                  >
                    {active ? 'Pause' : 'Preview'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTrack(track)}
                    className="rounded-full border border-white/20 px-3 py-2 text-xs hover:bg-white/5"
                  >
                    Details
                  </button>
                </div>
              </div>
            </article>
          )
        })}

        {filteredTracks.length === 0 && (
          <div className="col-span-full rounded-2xl border border-white/10 bg-bg-card/40 px-6 py-12 text-center text-text-secondary">
            No catalogue matches yet. Clear the search or browse the live radio rotation.
          </div>
        )}
      </section>

      <section className="mt-14 grid gap-6 border-t border-white/10 pt-10 md:grid-cols-[0.9fr_1.1fr] md:items-center">
        <div>
          <p className="text-xs tracking-[3px] text-brand uppercase mb-3">Visuals</p>
          <h2 className="text-3xl font-semibold mb-3">Keep the video lane clean until real footage lands.</h2>
          <p className="text-text-secondary">
            The page now uses real audio previews. Video cards are intentionally held back to studio and live-session placeholders so the catalogue does not pretend to have clips that are not ready yet.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { title: 'Studio Sessions', img: '/images/hero-studio.jpg' },
            { title: 'Live Drops', img: '/images/festival-crowd.jpg' },
          ].map((item) => (
            <div key={item.title}>
              <div className="relative aspect-video overflow-hidden rounded-xl border border-white/10">
                <Image src={item.img} alt={item.title} fill className="object-cover" />
                <div className="absolute inset-0 bg-black/30" />
              </div>
              <div className="mt-2 text-sm font-medium">{item.title}</div>
              <div className="text-xs text-text-secondary">Coming from real BVS shoots</div>
            </div>
          ))}
        </div>
      </section>

      {currentTrack && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/15 bg-black/95">
          {/* Runtime line: fills white as preview plays; full white at end */}
          <div
            className="h-1 w-full bg-white/15"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={Math.round(previewDuration)}
            aria-valuenow={Math.round(previewElapsed)}
            aria-label="Preview progress"
          >
            <div
              className="h-full bg-white transition-[width] duration-150 ease-linear"
              style={{
                width: `${previewDuration > 0 ? Math.min(100, (previewElapsed / previewDuration) * 100) : 0}%`,
              }}
            />
          </div>
          <div className="px-4 py-3">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded">
                  <Image src={currentTrack.artwork} alt="" fill className="object-cover" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{currentTrack.title}</div>
                  <div className="truncate text-xs text-text-secondary">{currentTrack.artist}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="block text-xs text-brand">{isPlaying ? 'Previewing' : previewElapsed >= previewDuration ? 'Preview complete' : 'Paused'}</span>
                  <span className="block tabular-nums text-xs text-text-secondary" aria-label={`${formatTime(previewElapsed)} elapsed of ${formatTime(previewDuration)} preview`}>
                    {formatTime(previewElapsed)} / {formatTime(previewDuration)}
                  </span>
                </div>
                <button type="button" onClick={stopPreview} className="rounded-full border border-white/20 px-4 py-2 text-xs hover:bg-white/5">
                  Stop
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedTrack && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4" onClick={() => setSelectedTrack(null)}>
          <div
            className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/10 bg-bg-primary shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="grid md:grid-cols-2">
              <div className="relative aspect-square">
                <Image src={selectedTrack.artwork} alt={selectedTrack.title} fill className="object-cover" />
                <button
                  type="button"
                  onClick={() => setSelectedTrack(null)}
                  className="absolute right-4 top-4 h-10 w-10 rounded-full bg-black/60 text-white hover:bg-black/80"
                  aria-label="Close details"
                >
                  x
                </button>
              </div>

              <div className="flex flex-col p-7">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs uppercase tracking-[2px] text-brand">{selectedTrack.genre}</span>
                  <span className="rounded bg-brand/10 px-2 py-1 text-[10px] tracking-widest text-brand">{selectedTrack.collection}</span>
                </div>
                <h2 className="text-4xl font-semibold mb-2">{selectedTrack.title}</h2>
                <p className="text-xl text-text-secondary">{selectedTrack.artist}</p>
                <p className="mt-1 text-sm text-text-secondary">
                  {selectedTrack.duration}
                  {selectedTrack.bpm ? ` · ${selectedTrack.bpm}` : ''}
                  {` · $${trackPrice(selectedTrack)}`}
                </p>
                <p className="mt-5 text-text-secondary">{selectedTrack.description}</p>

                <div className="mt-5 rounded-xl border border-brand/20 bg-brand/5 p-4">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-[2px] text-brand">{offerLabel(selectedTrack)}</div>
                  <p className="text-sm leading-relaxed text-text-secondary">{rightsSummary(selectedTrack)}</p>
                  {selectedTrack.type === 'beat' && (
                    <p className="mt-2 text-xs text-text-secondary">Need exclusivity, stems or sync use? Contact BVS for a written quote before checkout.</p>
                  )}
                </div>

                <div className="mt-7">
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-[2px]">Same collection</h3>
                  <div className="space-y-1">
                    {collectionTracks.map((track) => (
                      <button
                        key={track.id}
                        type="button"
                        onClick={() => setSelectedTrack(track)}
                        className={`flex w-full justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-white/5 ${
                          track.id === selectedTrack.id ? 'bg-brand/10 text-brand' : ''
                        }`}
                      >
                        <span className="min-w-0 truncate">{track.title}</span>
                        <span className="ml-4 flex-shrink-0 text-text-secondary">{track.bpm || track.duration}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-auto flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => previewTrack(selectedTrack)}
                    className="flex-1 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-black hover:bg-brand-dark"
                  >
                    {currentTrack?.id === selectedTrack.id && isPlaying ? 'Pause Preview' : 'Preview Track'}
                  </button>
                  <button
                    type="button"
                    onClick={() => addToCart(selectedTrack)}
                    className="flex-1 rounded-full border border-white/25 px-5 py-3 text-sm font-semibold hover:bg-white/5"
                  >
                    Add {selectedTrack.type === 'beat' ? 'licence' : 'download'} · ${trackPrice(selectedTrack)}
                  </button>
                  <Link
                    href="/checkout"
                    onClick={() => addToCart(selectedTrack)}
                    className="flex flex-1 items-center justify-center rounded-full bg-white px-5 py-3 text-center text-sm font-semibold text-black hover:bg-white/90"
                  >
                    Continue to checkout
                  </Link>
                </div>

                <Link href="/contact" className="mt-4 text-center text-sm text-brand hover:underline">
                  Ask BVS about rights, exclusive licensing, or audio services
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
