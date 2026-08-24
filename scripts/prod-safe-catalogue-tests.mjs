import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function requireText(source, text, message) {
  if (!source.includes(text)) throw new Error(message)
}

const artists = read('src/components/PublishedArtistsShelf.tsx')
const releases = read('src/components/PublishedAlbumsShelf.tsx')
const producers = read('src/components/PublishedProducersShelf.tsx')

requireText(artists, 'Artist directory', 'Artists must use the compact directory treatment')
requireText(artists, 'Artists on BVS', 'Artist directory heading missing')
requireText(releases, 'Release directory', 'Releases must use the compact directory treatment')
requireText(releases, 'Albums &amp; EPs', 'Release directory heading missing')
requireText(producers, 'All producers →', 'Producer directory must retain direct producer discovery')
requireText(producers, 'Open crate →', 'Producer directory must retain catalogue filtering')

for (const [name, source] of [['artists', artists], ['releases', releases], ['producers', producers]]) {
  if (source.includes('StationPlayer') || source.includes('useStationPlayer') || source.includes('bvs:queue')) {
    throw new Error(`${name} safe-production discovery must not change player behavior`)
  }
  if (source.includes('/api/auth/') || source.includes('supabase.auth')) {
    throw new Error(`${name} safe-production discovery must not change auth behavior`)
  }
}

console.log('prod-safe-catalogue-tests: ok')
