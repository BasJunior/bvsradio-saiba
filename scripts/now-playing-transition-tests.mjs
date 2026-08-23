import fs from 'node:fs'
import path from 'node:path'

function read(file) {
  return fs.readFileSync(file, 'utf8')
}

function requireText(source, text, message) {
  if (!source.includes(text)) throw new Error(message)
}

function sourceFiles(dir) {
  const found = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) found.push(...sourceFiles(full))
    else if (/\.(?:ts|tsx)$/.test(entry.name)) found.push(full)
  }
  return found
}

const layout = read('src/app/layout.tsx')
const policy = read('src/components/UniversalPlayerPresentation.tsx')
const commands = read('src/lib/bvs-playback.ts')
const details = read('src/components/ExploreItemDetails.tsx')
const actions = read('src/components/flow/BvsActionSheet.tsx')
const artistMusic = read('src/components/ArtistProfileMusic.tsx')
const artistBeats = read('src/components/ArtistProfileBeats.tsx')
const album = read('src/components/AlbumPlayer.tsx')
const player = read('src/components/StationPlayer.tsx')

requireText(layout, 'import UniversalPlayerPresentation from "@/components/UniversalPlayerPresentation";', 'Root layout must load the universal player policy')
requireText(layout, '<UniversalPlayerPresentation />', 'Universal player policy must be mounted under StationPlayerProvider')

requireText(policy, 'window.addEventListener("bvs:queue", onPlaybackCommand)', 'Universal policy must observe the shared playback command bus')
requireText(policy, 'command.action !== "play" && command.action !== "play-all"', 'Only play/play-all commands should force immersive presentation')
requireText(policy, 'queueMicrotask(present)', 'Presentation must run after StationPlayer consumes the playback command')
requireText(policy, 'player.setQueueOpen(false);', 'Universal policy must suppress the legacy queue sheet on play-now')
requireText(policy, 'player.openNowPlaying();', 'Universal policy must open Now Playing World')
requireText(policy, 'previous === currentIdentity', 'Universal policy must distinguish queue selection from unchanged transport state')
requireText(policy, 'player.queueOpen || !player.isPlaying', 'Queue track selection must be detected without changing transport behavior')

requireText(commands, 'export function playOnBvs(', 'Shared playback API must expose playOnBvs')
requireText(commands, 'export function playAllOnBvs(', 'Shared playback API must expose playAllOnBvs')
requireText(commands, 'action: "play-next"', 'Shared playback API must keep play-next distinct from play-now')
requireText(commands, 'action: "add"', 'Shared playback API must keep queue-add distinct from play-now')

requireText(details, 'playOnBvs(', 'Explore detail play must use the shared playback command')
requireText(details, 'playAllOnBvs(tracks,', 'Explore release play must use the shared playback command')
requireText(details, 'if (player.nowPlayingOpen) return null', 'Detail UI must stay mounted behind Now Playing for reverse transition')
requireText(details, 'const nowPlayingOpenRef = useRef(player.nowPlayingOpen)', 'Detail focus state must survive the universal player overlay')
if (details.includes('player.openNowPlaying()') || details.includes('player.setQueueOpen(false)')) {
  throw new Error('Explore detail must not own player presentation anymore')
}

requireText(actions, 'dispatchBvsPlayback({ action: queueAction, track', 'Flow action sheet must use the shared command bus')
if (actions.includes('useStationPlayer') || actions.includes('openNowPlaying')) {
  throw new Error('Flow action sheet must not implement its own player presentation')
}

requireText(artistMusic, 'playAllOnBvs(stationTracks', 'Artist Play all must inherit the universal presentation rule')
requireText(artistMusic, 'playOnBvs(stationTrack', 'Artist track Play must inherit the universal presentation rule')
requireText(artistBeats, 'playOnBvs(media', 'Artist beat Preview must inherit the universal presentation rule')
requireText(album, 'playAllOnBvs(ordered', 'Album playback must inherit the universal presentation rule')

const bypasses = []
for (const file of sourceFiles('src')) {
  if (file.endsWith(path.join('components', 'StationPlayer.tsx'))) continue
  const source = read(file)
  if (/\.playNow\s*\(/.test(source) || /\.playAll\s*\(/.test(source)) bypasses.push(file)
}
if (bypasses.length) {
  throw new Error(`Playback surfaces must use the universal command contract, not StationPlayer internals: ${bypasses.join(', ')}`)
}

requireText(player, 'const closeNowPlaying = useCallback(() => setNowPlayingOpen(false), []);', 'Closing Now Playing must remain overlay-only')
requireText(player, 'onClick={player.openNowPlaying}', 'Persistent/current-player surfaces must still reopen Now Playing World')
requireText(player, 'const toggle = useCallback(async () => {', 'Play/pause transport must keep its independent path')
if (/const toggle = useCallback[\s\S]{0,1800}openNowPlaying/.test(player)) {
  throw new Error('Play/pause transport must not force Now Playing World open')
}

console.log('now-playing-transition-tests: universal policy ok')
