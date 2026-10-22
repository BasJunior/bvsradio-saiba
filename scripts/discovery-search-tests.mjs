import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function modules(globals = {}) {
  const cache = new Map();
  function load(path) {
    if (cache.has(path)) return cache.get(path);
    const exports = {}; cache.set(path, exports);
    const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    vm.runInNewContext(code, { exports, URL, URLSearchParams, AbortSignal, console, process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://db.example', SUPABASE_SERVICE_ROLE_KEY: 'server-secret' } }, ...globals, require(name) {
      if (name === 'server-only') return {};
      if (name === '@/lib/catalogue-curated-tracks') return { curatedCatalogueTracks: [{ id: 1, title: 'Archive Treasure', artist: 'Archive Artist', genre: 'Gospel', collection: 'Archive', src: '/archive.mp3', artwork: '/cover.jpg', type: 'single' }] };
      if (name === '@/lib/discovery') return { discoveryItems: [{ id: 'archive', kind: 'track', title: 'Archive Treasure', subtitle: 'Archive Artist · Archive', href: '/catalogue?q=Archive' }] };
      if (name === '@/lib/blog') return { blogPosts: [] };
      if (name === '@/lib/official-services') return { officialBvsServices: [] };
      if (name === '@/lib/catalogue-pricing') return { PRICE_SINGLE_DOWNLOAD: 2 };
      if (name === 'next/server') return { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } };
      const target = name.startsWith('@/') ? `src/${name.slice(2)}.ts` : `src/lib/${name.replace(/^\.\//, '')}.ts`;
      return load(target);
    } });
    return exports;
  }
  return load;
}
const load = modules();
const { discoveryQueryScore: score, matchesDiscoveryQuery: matches } = load('src/lib/discovery-search.ts');
assert(matches('hills w', ['W.Hill$']));
assert(matches('cafe', ['Café']));
assert(matches('wolf bridges', ['WolfBridges']));
assert(matches('moon basjunior', ['On the Moon', 'BasJunior']));
assert(matches('extraterrestial', ['extraterrestrial']));
assert(matches('Opium', ['Opium']));
assert(!matches('totally missing', ['On the Moon', 'BasJunior']));
assert(!matches('x', ['Opium']));
assert(!matches('!!!', ['Opium']));
assert(score('Opium', ['Opium']) > score('Opium', ['Opium Remix']));
assert(score('Opium', ['Opium Remix']) > score('Opium', ['Something', 'Opium']));
const { readDiscoveryPages } = load('src/lib/discovery-pagination.ts');
const many = Array.from({ length: 1205 }, (_, i) => ({ id: String(i).padStart(5, '0') }));
const all = await readDiscoveryPages(async after => many.filter(row => !after || row.id > after).slice(0, 17));
assert.equal(all.length, many.length, 'A database row cap smaller than pageSize must not truncate the index');
await assert.rejects(() => readDiscoveryPages(async () => [{ id: 'same' }]), /did not advance/);

const tracks = Array.from({ length: 310 }, (_, i) => ({ id: `t${String(i).padStart(4, '0')}`, title: `Recording ${i}`, artist_name: 'Dual Creator', user_id: 'dual', is_public: true, editorial_status: 'approved', genre: 'Hip Hop', file_url: `tracks/${i}.mp3`, release_id: 'r0000', cleared: i % 2 === 0, in_rotation: false }));
tracks[309].title = tracks[0].title;
tracks.push({ ...tracks[0], id: 'private-track', title: 'Private Secret', is_public: false }, { ...tracks[0], id: 'pending-track', title: 'Pending Secret', editorial_status: 'submitted' });
const fixtures = {
  tracks,
  releases: Array.from({ length: 120 }, (_, i) => ({ id: `r${String(i).padStart(4, '0')}`, title: `Album ${i}`, artist_name: 'Dual Creator', is_public: true, editorial_status: 'approved', release_type: 'ep' })),
  beats: Array.from({ length: 180 }, (_, i) => ({ id: `b${String(i).padStart(4, '0')}`, title: `Production ${i}`, producer_user_id: 'dual', is_public: true, status: 'published', rights_confirmed: true, genre: 'Gospel', master_path: 'SECRET_MASTER', stems_path: 'SECRET_STEMS', beat_licence_options: [{ price_usd: 29, is_active: true }] })),
  music_videos: [{ id: 'v1', related_track_id: 't0000', video_url: 'video/test.mp4', poster_url: 'video/poster.jpg', is_public: true, editorial_status: 'approved', content_hold: false }],
  profiles: [{ id: 'dual', username: 'dual-creator', role: 'artist', is_published: true, is_producer: true, is_verified: false, creator_public_name: 'Dual Creator', email: 'SECRET_EMAIL' }, { id: 'new', username: 'new-artist', role: 'artist', is_published: true, is_verified: false }, { id: 'private', username: 'private-identity', role: 'artist', is_published: false }],
  playlists: Array.from({ length: 70 }, (_, i) => ({ id: `p${String(i).padStart(4, '0')}`, title: `Playlist ${i}`, user_id: 'dual', is_public: true })),
  playlist_tracks: [],
  track_credits: [{ id: 'c1', track_id: 't0000', person_name: 'Guest Singer', is_verified: true, profile_url: '/artist/new-artist' }],
  creator_marketplace_listings: [{ id: 'l1', title: 'Sample Pack', slug: 'sample-pack', seller_user_id: 'dual', listing_type: 'digital_product', status: 'published' }, { id: 'l2', title: 'Mix Service', slug: 'mix-service', seller_user_id: 'dual', listing_type: 'service', status: 'published' }, { id: 'l3', title: 'Private Listing', status: 'draft' }],
  programmes: [{ id: 'pg1', slug: 'night-show', title: 'Night Show', status: 'active' }],
  show_creator_profiles: [{ id: 'show1', slug: 'creator-show', title: 'Creator Show', status: 'approved' }],
  show_episodes: [{ id: 'episode1', show_id: 'show1', title: 'Pilot Episode', status: 'published' }],
};
let failedSource, calls = [];
const fetchDB = async (address, options) => {
  const url = new URL(address), source = url.pathname.split('/').at(-1), params = url.searchParams;
  calls.push(address);
  assert.equal(options.headers.Authorization, 'Bearer server-secret');
  assert.notEqual(params.get('select'), '*', 'Public search must use explicit column projections');
  if (source === failedSource) return { ok: false };
  let data = [...(fixtures[source] || [])];
  for (const field of ['is_public', 'editorial_status', 'status', 'rights_confirmed', 'is_published', 'is_verified', 'content_hold']) {
    const filter = params.get(field);
    if (filter?.startsWith('eq.')) data = data.filter(row => String(row[field]) === filter.slice(3));
    if (filter?.startsWith('in.')) data = data.filter(row => filter.slice(4, -1).split(',').includes(row[field]));
  }
  if (params.has('mobile_distribution_clearances.surface')) data = data.filter(row => row.cleared);
  const after = params.get('id')?.replace(/^gt\./, '');
  data = data.sort((a, b) => a.id.localeCompare(b.id)).filter(row => !after || row.id > after).slice(0, 17);
  return { ok: true, json: async () => data };
};
const withDB = modules({ fetch: fetchDB });
const { loadDiscoverySnapshot, getDiscoverySnapshot } = withDB('src/lib/discovery-index.ts');
const snapshot = await loadDiscoverySnapshot('web');
assert.equal(snapshot.unavailable.length, 0);
for (const [kind, count] of [['track', 311], ['beat', 180], ['release', 120], ['playlist', 70], ['product', 1], ['service', 1]]) {
  assert.equal(snapshot.items.filter(item => item.kind === kind).length, count, `Full ${kind} coverage beyond old caps`);
}
assert(snapshot.items.some(item => item.title === 'Production 179'));
assert.equal(snapshot.items.filter(item => item.title === 'Recording 0').length, 2, 'Distinct live recordings must not be merged by title');
assert(snapshot.items.find(item => item.id === 'track-t0000').playback.musicVideoUrl.endsWith('video/test.mp4'));
assert.equal(snapshot.items.find(item => item.id === 'track-t0000').playback.creatorId, 'dual');
assert(snapshot.items.some(item => item.title === 'Archive Treasure'));
assert(snapshot.items.some(item => item.id === 'artist-dual'));
assert(snapshot.items.some(item => item.id === 'producer-dual'));
assert(snapshot.items.some(item => item.id === 'artist-new'), 'Published profiles must not require verification or an owned track');
assert(!snapshot.items.some(item => item.title.includes('Secret') || item.title === 'Private Listing' || item.title === 'private-identity'));
const serialized = JSON.stringify(snapshot);
for (const privateValue of ['SECRET_EMAIL', 'SECRET_MASTER', 'SECRET_STEMS', 'server-secret']) assert(!serialized.includes(privateValue));
assert(snapshot.items.find(item => item.kind === 'beat').detail.price === 29);
assert(snapshot.items.some(item => item.href === '/shows/creator-show#episode-episode1'));
const select = withDB('src/lib/discovery-search-results.ts').selectDiscoveryResults;
assert(select(snapshot.items, new URLSearchParams({ q: 'guest singer', type: 'track' })).items.some(item => item.id === 'track-t0000'), 'Verified collaborator credits must be searchable');
assert.equal(select(snapshot.items, new URLSearchParams({ q: 'album 0', type: 'track' })).total, 310, 'Album titles must find member songs');
const page1 = select(snapshot.items, new URLSearchParams({ type: 'beat', limit: '100' }));
const page2 = select(snapshot.items, new URLSearchParams({ type: 'beat', offset: '100', limit: '100' }));
assert.equal(new Set([...page1.items, ...page2.items].map(item => item.id)).size, 180);
assert.equal(page1.total, 180);
assert.equal(select(snapshot.items, new URLSearchParams({ q: 'production 179', type: 'beat' })).items[0].title, 'Production 179');
assert.equal(select(snapshot.items, new URLSearchParams({ q: 'production', genre: 'hip-hop' })).total, 0);
const native = await loadDiscoverySnapshot('ios');
assert.equal(native.items.filter(item => item.kind === 'track').length, 155, 'Native includes all cleared songs, including non-rotation tracks');
assert(native.items.every(item => ['track', 'artist', 'producer', 'beat'].includes(item.kind)));
assert(native.items.every(item => item.href.startsWith('/app/ios/')));
assert(!native.items.some(item => item.title === 'Archive Treasure'));
assert(calls.some(address => address.includes('mobile_distribution_clearances.surface=eq.ios')));
failedSource = 'beats';
const partial = await getDiscoverySnapshot('android');
assert(partial.unavailable.includes('beats'));
assert(partial.items.some(item => item.kind === 'track'));
failedSource = undefined;
const retried = await getDiscoverySnapshot('android');
assert.equal(retried.unavailable.length, 0, 'Failed snapshots must remain retryable');
const startCalls = calls.length;
const [a, b] = await Promise.all([getDiscoverySnapshot('web'), getDiscoverySnapshot('web')]);
assert.equal(a, b, 'Concurrent requests must share one snapshot build');
assert(calls.length > startCalls);
const afterBuild = calls.length;
await getDiscoverySnapshot('web');
assert.equal(calls.length, afterBuild, 'Queries must reuse the short-lived public snapshot');
const api = withDB('src/app/api/search/route.ts');
assert.equal((await api.GET(new Request('https://bvsradio.com/api/search?surface=other'))).status, 400);
assert.equal((await api.GET(new Request('https://bvsradio.com/api/search?type=private'))).status, 400);
const response = await api.GET(new Request('https://bvsradio.com/api/search?q=production%20179&type=beat'));
assert.equal(response.status, 200);
assert.equal(response.body.items[0].title, 'Production 179');
console.log('Complete search passed: database pagination, all categories, archive supplement, dual roles, unverified public creators, album/credit matching, ranking, native clearance, privacy, partial recovery, cache and API validation.');
