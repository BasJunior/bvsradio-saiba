export type DiscoveryKind = 'track' | 'artist' | 'show'

export interface DiscoveryItem {
  id: string
  kind: DiscoveryKind
  title: string
  subtitle: string
  href: string
  image?: string
  tags?: string[]
}

// This index deliberately contains only media that exists in the BVS catalogue.
// Replace or extend it when artist and show submissions are published.
export const discoveryItems: DiscoveryItem[] = [
  { id: 'track-rgm-airport', kind: 'track', title: 'Robert Gabriel Mugabe International Airport', subtitle: 'BVS Radio · BVS Archive', href: '/catalogue?q=Robert%20Gabriel', image: '/music/Bvs-3000x3000%202.png', tags: ['BVS Original', 'archive'] },
  { id: 'track-bvs-slide', kind: 'track', title: 'BVS Slide', subtitle: 'BVS Radio · BVS Archive', href: '/catalogue?q=BVS%20Slide', image: '/music/Bvs-3000x3000%202.png', tags: ['BVS Original', 'mix'] },
  { id: 'track-never-ending', kind: 'track', title: 'Never Ending Mix', subtitle: 'BVS x Brx · BVS Archive', href: '/catalogue?q=Never%20Ending', image: '/music/Bvs-3000x3000%202.png', tags: ['BVS Original', 'mix'] },
  { id: 'track-calm-beast', kind: 'track', title: 'Calm Beast', subtitle: 'Mahendere · BVS Archive', href: '/catalogue?q=Calm%20Beast', image: '/music/Bvs-3000x3000%202.png', tags: ['gospel', 'Zimbabwe'] },
  { id: 'track-mellisa', kind: 'track', title: 'Mellisa', subtitle: 'WolfBrx · June Pack', href: '/catalogue?q=Mellisa', image: '/images/music-packs/june-pack.jpg', tags: ['beat', 'hip-hop', '156 BPM'] },
  { id: 'track-in-my-city', kind: 'track', title: 'In My City', subtitle: 'WolfBrx · June Pack', href: '/catalogue?q=In%20My%20City', image: '/images/music-packs/june-pack.jpg', tags: ['beat', 'hip-hop', '170 BPM'] },
  { id: 'track-rgb', kind: 'track', title: 'RGB', subtitle: 'WolfBrx · June Pack', href: '/catalogue?q=RGB', image: '/images/music-packs/june-pack.jpg', tags: ['beat', 'trap', '160 BPM'] },
  { id: 'track-fading-memories', kind: 'track', title: 'Fading Memories', subtitle: 'WolfBrx + Znayshi · March Pack', href: '/catalogue?q=Fading%20Memories', image: '/images/mic-closeup.jpg', tags: ['beat', 'melodic rap'] },
  { id: 'track-the-giant', kind: 'track', title: 'The Giant', subtitle: 'WolfBrx + Dannynevamiss · March Pack', href: '/catalogue?q=The%20Giant', image: '/images/musicians.jpg', tags: ['beat', 'hip-hop'] },
  { id: 'track-chiraq-drillaz', kind: 'track', title: 'Chiraq Drillaz', subtitle: 'WolfBrx · January Pack', href: '/catalogue?q=Chiraq%20Drillaz', image: '/images/festival-crowd.jpg', tags: ['beat', 'drill', '158 BPM'] },
  { id: 'artist-bvs-radio', kind: 'artist', title: 'BVS Radio', subtitle: 'Originals and archive recordings', href: '/artist/bvs-radio', image: '/music/Bvs-3000x3000%202.png', tags: ['artist', 'station'] },
  { id: 'artist-wolfbrx', kind: 'artist', title: 'WolfBrx', subtitle: 'Producer on BVS Radio', href: '/artist/wolfbrx', image: '/images/musicians.jpg', tags: ['artist', 'producer', 'beats'] },
  { id: 'show-harare-after-dark', kind: 'show', title: 'Harare After Dark', subtitle: 'Programme preview · launch date to be announced', href: '/shows/harare-after-dark', image: '/images/editorial/music-discovery-show.webp', tags: ['show', 'preview', 'late night'] },
  { id: 'show-studio-stories', kind: 'show', title: 'Studio Stories', subtitle: 'Programme preview · launch date to be announced', href: '/shows/studio-stories', image: '/images/editorial/audio-engineering-work.webp', tags: ['show', 'preview', 'interviews'] },
  { id: 'show-new-zimbabwean-sound', kind: 'show', title: 'New Zimbabwean Sound', subtitle: 'Programme preview · launch date to be announced', href: '/shows/new-zimbabwean-sound', image: '/images/editorial/radio-studio-harare.webp', tags: ['show', 'preview', 'discovery', 'Zimbabwe'] },
]
