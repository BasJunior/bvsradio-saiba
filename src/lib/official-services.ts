export type OfficialBvsService = {
  id: string
  title: string
  engineer: string
  price: string
  startingPriceUsd: number
  category: string
  tiers: Array<{ name: string; price: string; desc: string }>
  desc: string
}

export const officialBvsServices: OfficialBvsService[] = [
  {
    id: 'mixing',
    title: 'Mixing',
    engineer: 'BVS Audio Services',
    price: 'From $89',
    startingPriceUsd: 89,
    category: 'Mixing',
    tiers: [
      { name: 'Basic Mix', price: '$89', desc: 'Mix from supplied stems, 1 revision' },
      { name: 'Pro Mix', price: '$149', desc: 'Detailed mix, delivery master + instrumental, 2 revisions' },
      { name: 'Premium Mix', price: '$199', desc: 'Complex session review and priority scheduling; scope confirmed first' },
    ],
    desc: 'Professional mixing that brings your track to life. Reference tracks welcome.',
  },
  {
    id: 'mastering',
    title: 'Mastering',
    engineer: 'BVS Audio Services',
    price: 'From $69',
    startingPriceUsd: 69,
    category: 'Mastering',
    tiers: [
      { name: 'Standard Master', price: '$69', desc: 'Release-format master, 1 revision' },
      { name: 'Premium Master', price: '$99', desc: 'Stem review where supplied, 2 revisions' },
      { name: 'Album Master', price: '$299', desc: 'Up to 14 tracks, consistent loudness across project' },
    ],
    desc: 'Industry-standard mastering for Spotify, Apple Music and all platforms.',
  },
  {
    id: 'mix-master-bundle',
    title: 'Mix + Master Bundle',
    engineer: 'BVS Audio Services',
    price: 'From $189',
    startingPriceUsd: 189,
    category: 'Mixing and mastering',
    tiers: [
      { name: 'Standard Bundle', price: '$189', desc: 'Pro mix + standard master' },
      { name: 'Premium Bundle', price: '$249', desc: 'Premium mix + premium master; deliverables confirmed first' },
    ],
    desc: 'Complete post-production package with one clear scope and delivery plan.',
  },
  {
    id: 'ultimate-bundle',
    title: 'Ultimate Bundle',
    engineer: 'BVS Audio Services',
    price: 'From $299',
    startingPriceUsd: 299,
    category: 'Release preparation',
    tiers: [
      { name: 'Ultimate Bundle', price: '$299', desc: 'Professional mix + release-format master + publishing setup support' },
    ],
    desc: 'Take one song from final stems to a release-ready master with publishing setup support in one coordinated package.',
  },
  {
    id: 'vocal-production',
    title: 'Vocal Production',
    engineer: 'BVS Audio Services',
    price: 'From $65',
    startingPriceUsd: 65,
    category: 'Vocal production',
    tiers: [
      { name: 'Vocal Comping & Tuning', price: '$65', desc: 'Full comp + pitch correction. 1 revision.' },
      { name: 'Full Vocal Production', price: '$129', desc: 'Editing and arrangement support from supplied takes. 2 revisions.' },
    ],
    desc: 'Bring your vocals to professional level.',
  },
]
