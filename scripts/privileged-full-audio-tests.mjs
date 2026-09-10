import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')
const assert = (condition, message) => { if (!condition) throw new Error(message) }

const fullPlayer = read('src/components/FullAccessAudioPlayer.tsx')
const editorialPlayer = read('src/components/editorial/EditorialConnectedPreview.tsx')
const editorialReviewAudio = read('src/app/api/admin/editorial/review-audio/route.ts')
const editorialApi = read('src/app/api/admin/editorial/route.ts')
const workItem = read('src/app/api/admin/editorial/work-item/route.ts')
const editorialPage = read('src/app/admin/editorial/page.tsx')
const releases = read('src/components/ReleaseEditorialPanel.tsx')
const mine = read('src/app/api/beats/route.ts')
const myBeats = read('src/components/MyBeatStore.tsx')
const creatorApi = read('src/app/api/creator/workspace/route.ts')
const studio = read('src/app/creator/studio/manage/page.tsx')

assert(fullPlayer.includes('useStationPlayer'), 'trusted playback must use the persistent BVS player')
assert(!/45\s*\*|>=\s*45|>\s*45|max(?:imum)?Duration.{0,20}45/i.test(fullPlayer), 'trusted playback must not impose a 45-second cap')
assert(editorialPlayer.includes('useStationPlayer'), 'Editorial full review must use the persistent BVS player')
assert(!/45\s*\*|>=\s*45|>\s*45|max(?:imum)?Duration.{0,20}45/i.test(editorialPlayer), 'Editorial full review must not impose a 45-second cap')
assert(editorialPlayer.includes('/api/admin/editorial/review-audio?'), 'Canonical Editorial player must resolve its authorized full source at play time')
assert(editorialPlayer.includes('const playableSrc = target ? resolvedSrc : (src || null)'), 'Known Editorial objects must not fall back to a caller-provided preview URL')
assert(editorialReviewAudio.includes("select=id,master_path"), 'Editorial beat playback must resolve the submitted master')
assert(!editorialReviewAudio.includes('preview_path'), 'Strict Editorial review-audio resolver must never substitute a BeatStore preview')
assert(editorialReviewAudio.includes("select=id,file_url,audio_path"), 'Editorial release-member playback must resolve the full uploaded track source')
assert(editorialReviewAudio.includes("select=id,file_url"), 'Editorial single playback must resolve the full uploaded track source')

assert(editorialApi.includes('review_audio_url: await signStoredMedia(String(beat.master_path || beat.preview_path'), 'Legacy Editorial payload may prefer the private master while canonical player enforces strict master resolution')
assert(editorialApi.includes("file_url: await signStoredMedia(String(track.file_url || track.audio_path"), 'Editorial release tracks receive signed full submitted audio')
assert(workItem.includes('text(beat.master_path) || text(beat.preview_path)'), 'Legacy work payload prefers full beat master; canonical player re-resolves it strictly')
assert(editorialPage.includes('beat.review_audio_url || beat.master_path'), 'BeatStore Editorial presents trusted review audio through the canonical player')
assert(releases.includes('m.review_audio_url || m.file_url'), 'Album/EP Editorial uses full submitted member audio')
assert(!releases.includes('<audio controls preload="none" src={media.preview_path}'), 'Editorial must not expose the clipped processing preview as its review player')
assert(mine.includes('master_path: await privateMediaUrl(beat.master_path)'), 'Owner BeatStore API signs the private master')
assert(myBeats.includes('src={beat.master_path || beat.preview_path}'), 'Producer listening to own submission prefers the full master')
assert(creatorApi.includes('file_url: await privateMediaUrl(String(track.file_url'), 'Artist workspace signs full owned single audio')
assert(creatorApi.includes('releaseTracks'), 'Artist workspace returns owned album/EP member audio')
assert(creatorApi.includes('audio_url: await privateMediaUrl(String(episode.audio_path'), 'Show creator gets full own episode audio')
assert(studio.includes('FullAccessAudioPlayer'), 'Studio exposes full owner playback')

// Public BeatStore shaping stays on previewUrl and never returns master_path in the public object.
const publicShape = mine.slice(mine.indexOf('// public published beats for catalogue / BeatStore'))
assert(publicShape.includes('previewUrl: publicStorageUrl(b.preview_path)'), 'Public BeatStore continues to use preview audio')
assert(!publicShape.includes('masterUrl:'), 'Public BeatStore must not expose private masters')

console.log('privileged full-audio checks passed')
