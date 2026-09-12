import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSearchSuggestions, filterSearchSuggestions, searchPageHref } from '../src/lib/header-search.ts';

const data = {
  artists: [{ id: 'artist-1', username: 'a name', name: 'Artist One' }],
  producers: [{ id: 'producer-1', username: 'producer', name: 'Producer One', beatCount: 3 }],
  beats: [{ id: 'beat-1', title: 'Beat & Rhythm', producer: 'Producer One' }],
  tracks: [{ id: 'track-1', title: 'Music & Sound', artist: 'Artist One' }],
};
for (const surface of ['ios', 'android', null]) {
  const items = buildSearchSuggestions(data, surface);
  assert.equal(items.length, 4);
  assert.equal(items.find(i => i.kind === 'Beat').href, `${surface ? `/app/${surface}` : ''}/beat/beat-1`);
  assert.equal(items.find(i => i.kind === 'Artist').href, surface ? `/app/${surface}/creator/artist-1` : '/artist/a%20name');
  assert.equal(items.find(i => i.kind === 'Producer').href, surface ? `/app/${surface}/creator/producer-1?as=producer` : '/artist/producer');
  for (const item of items) {
    assert(!item.href.includes('undefined'));
    if (surface) assert(item.href.startsWith(`/app/${surface}/`));
  }
  const musicUrl = new URL(items.find(i => i.kind === 'Music').href, 'https://bvsradio.com');
  assert.equal(musicUrl.searchParams.get('q'), 'Music & Sound');
  if (surface) assert.equal(musicUrl.searchParams.get('kind'), 'music');
  assert.equal(filterSearchSuggestions(items, '  BEAT &  ').length, 1);
  assert.equal(filterSearchSuggestions(items, 'absent').length, 0);
  assert.equal(filterSearchSuggestions(items, 'a').length, 0);
  assert.equal(new URL(searchPageHref('a & b/中', surface), 'https://bvsradio.com').searchParams.get('q'), 'a & b/中');
}
assert.equal(buildSearchSuggestions({ artists: [{ id: 'bad', name: 'No username' }] }, null).length, 0);
const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const top = read('src/components/app-vnext/AppTopBar.tsx');
assert(top.includes('<HeaderSearch iconOnly surface={surface} />'));
assert(top.includes('href={`/app/${surface}/you`}'));
const explore = read('src/components/app-vnext/AppExploreClient.tsx');
assert(explore.includes('<ExploreArtwork src={item.image}'));
assert(explore.includes('<ExploreArtwork src={item.artworkUrl}'));
assert(explore.includes('onError={() => setFailedSrc(image)}'));
console.log('Header search routing, query escaping, published identities, Explore artwork and profile access passed.');
