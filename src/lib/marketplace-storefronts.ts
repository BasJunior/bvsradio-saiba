import { officialBvsServices } from '@/lib/official-services'

export type StorefrontService = {
  id: string
  listingId?: string
  listingType?: 'service' | 'digital_product'
  title: string
  category: string
  description: string
  priceUsd: number
  priceLabel?: string
  packages?: Array<{ name: string; description?: string; priceUsd: number }>
  bookingMode: 'calendar' | 'checkout' | 'enquiry'
  turnaroundDays?: number | null
  revisionsIncluded?: number | null
  note?: string
}

export type MarketplaceStorefront = {
  slug: string
  sellerUserId?: string
  source: 'seed' | 'creator'
  name: string
  kind: 'studio' | 'engineer' | 'producer' | 'official'
  headline: string
  bio: string
  location?: string
  heroImage?: string
  avatarImage?: string
  specialties: string[]
  verified: boolean
  official?: boolean
  username?: string
  services: StorefrontService[]
  policyNotes?: string[]
}

type MarketplaceProfileRow = {
  user_id: string
  roles?: string[]
  headline?: string
  bio?: string
  skills?: string[]
  profiles?: {
    username?: string
    creator_public_name?: string
    display_name?: string
    avatar_url?: string
  }
}

type MarketplaceListingRow = {
  id: string
  seller_user_id: string
  listing_type: string
  category: string
  title: string
  description?: string
  price_usd: number | string
  artwork_path?: string
  packages?: Array<{ name?: string; description?: string; priceUsd?: number }>
  turnaround_days?: number | null
  revisions_included?: number | null
}

export function storefrontSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

export const seededStorefronts: MarketplaceStorefront[] = [
  {
    slug: 'wolfbridges-studio',
    source: 'seed',
    name: 'WolfBridges Studio',
    kind: 'studio',
    headline: 'Recording, mixing, mastering and beat-based production in Harare.',
    bio: 'WolfBridges Studio offers music production services for artists who need recording, mixing, mastering and beat-based production support in one place.',
    location: 'Madokero, Harare',
    heroImage: '/images/marketplace/wolfbridges-studio.jpg',
    specialties: ['Recording', 'Mixing', 'Mastering', 'Music production', 'Beat leases'],
    verified: false,
    services: [
      {
        id: 'record-mix-master-own-beat',
        title: 'Recording + Mix & Mastering',
        category: 'Production package',
        description: 'Record your song at WolfBridges Studio using your own beat, then have the track mixed and mastered.',
        priceUsd: 30,
        bookingMode: 'calendar',
      },
      {
        id: 'record-beat-mix-master',
        title: 'Recording + Beat + Mix & Mastering',
        category: 'Production package',
        description: 'A studio production package covering recording, a beat, mixing and mastering.',
        priceUsd: 80,
        bookingMode: 'calendar',
      },
      {
        id: 'beat-lease-mp3',
        title: 'Beat Lease — MP3',
        category: 'Beat package',
        description: 'MP3 beat lease from the WolfBridges catalogue.',
        priceUsd: 30,
        bookingMode: 'enquiry',
      },
      {
        id: 'beat-lease-mp3-wav',
        title: 'Beat Lease — MP3 + WAV',
        category: 'Beat package',
        description: 'Beat lease supplied as MP3 and WAV files.',
        priceUsd: 50,
        bookingMode: 'enquiry',
      },
    ],
    policyNotes: ['No custom beats.', 'No beat remakes.'],
  },
  {
    slug: 'bvs-studio-services',
    source: 'seed',
    name: 'BVS Studio Services',
    kind: 'official',
    headline: 'Official BVS mixing, mastering and vocal-production services.',
    bio: 'Official BVS production services now live inside the same Marketplace as independent studios and engineers.',
    location: 'Remote / BVS',
    heroImage: '/images/hero-studio.jpg',
    specialties: ['Mixing', 'Mastering', 'Vocal production', 'Release preparation'],
    verified: true,
    official: true,
    services: officialBvsServices.map((service) => ({
      id: service.id,
      title: service.title,
      category: service.category,
      description: service.desc,
      priceUsd: service.startingPriceUsd,
      priceLabel: service.price,
      packages: service.tiers.map((tier) => ({
        name: tier.name,
        description: tier.desc,
        priceUsd: Number(tier.price.replace(/[^0-9.]/g, '')) || service.startingPriceUsd,
      })),
      bookingMode: 'enquiry' as const,
    })),
  },
]

export function liveStorefronts(
  profiles: MarketplaceProfileRow[],
  listings: MarketplaceListingRow[],
): MarketplaceStorefront[] {
  return profiles.map((profile) => {
    const displayName =
      profile.profiles?.creator_public_name ||
      profile.profiles?.display_name ||
      profile.profiles?.username ||
      'BVS creator'
    const username = profile.profiles?.username || ''
    const roles = profile.roles || []
    const kind: MarketplaceStorefront['kind'] = roles.includes('studio')
      ? 'studio'
      : roles.includes('engineer')
        ? 'engineer'
        : 'producer'
    const services = listings
      .filter((listing) => listing.seller_user_id === profile.user_id)
      .map((listing): StorefrontService => ({
        id: listing.id,
        listingId: listing.id,
        listingType: listing.listing_type === 'digital_product' ? 'digital_product' : 'service',
        title: listing.title,
        category: listing.category.replaceAll('_', ' '),
        description: listing.description || '',
        priceUsd: Number(listing.price_usd) || 0,
        packages: Array.isArray(listing.packages)
          ? listing.packages.map((item) => ({
              name: String(item.name || 'Package'),
              description: String(item.description || ''),
              priceUsd: Number(item.priceUsd) || Number(listing.price_usd) || 0,
            }))
          : [],
        bookingMode: listing.listing_type === 'service' ? 'calendar' : 'checkout',
        turnaroundDays: listing.turnaround_days,
        revisionsIncluded: listing.revisions_included,
      }))
    return {
      slug: storefrontSlug(displayName),
      sellerUserId: profile.user_id,
      source: 'creator',
      name: displayName,
      kind,
      headline: profile.headline || `${kind.replaceAll('_', ' ')} on BVS`,
      bio: profile.bio || '',
      heroImage: profile.profiles?.avatar_url,
      avatarImage: profile.profiles?.avatar_url,
      specialties: [...new Set([...(profile.skills || []), ...roles])].slice(0, 10),
      verified: true,
      username: username || undefined,
      services,
    }
  })
}

function serviceKey(service: StorefrontService) {
  return service.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function mergeServices(seed: StorefrontService[], live: StorefrontService[]) {
  const merged = new Map(seed.map((service) => [serviceKey(service), service]))
  for (const service of live) merged.set(serviceKey(service), service)
  return [...merged.values()]
}

export function marketplaceStorefronts(
  profiles: MarketplaceProfileRow[],
  listings: MarketplaceListingRow[],
): MarketplaceStorefront[] {
  const live = liveStorefronts(profiles, listings)
  const claimed = new Set<string>()
  const seeded = seededStorefronts.map((seed) => {
    const claim = live.find((item) => item.slug === seed.slug)
    if (!claim) return seed
    claimed.add(claim.slug)
    return {
      ...seed,
      sellerUserId: claim.sellerUserId,
      username: claim.username,
      verified: seed.verified || claim.verified,
      services: mergeServices(seed.services, claim.services),
    }
  })
  return [...seeded, ...live.filter((item) => !claimed.has(item.slug))]
}

export function seededStorefront(slug: string) {
  return seededStorefronts.find((item) => item.slug === slug) || null
}
