import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function requireText(source, text, message) {
  if (!source.includes(text)) throw new Error(message)
}

const details = read('src/components/ExploreItemDetails.tsx')
const actions = read('src/components/flow/BvsActionSheet.tsx')
const player = read('src/components/StationPlayer.tsx')

requireText(details, 'const enterNowPlaying = () => {', 'Explore details must share one transition helper')
requireText(details, 'player.setQueueOpen(false)', 'Explicit detail play must suppress the queue sheet')
requireText(details, 'player.openNowPlaying()', 'Explicit detail play must open Now Playing World')
requireText(details, 'player.playNow(', 'Track/beat detail must keep the shared StationPlayer playNow path')
requireText(details, 'player.playAll(tracks,', 'Release detail must keep the shared StationPlayer playAll path')
requireText(details, 'enterNowPlaying()', 'Track/release play must enter the immersive player after playback starts')
requireText(details, 'const suspendedForPlayerRef = useRef(false)', 'Detail state must survive the immersive player transition')
requireText(details, 'if (player.nowPlayingOpen) return null', 'Detail UI must suspend behind Now Playing and restore on collapse')
requireText(details, '[onClose, player.nowPlayingOpen]', 'Detail focus/scroll lifecycle must follow the reversible player state')

const transitionStart = details.indexOf('const enterNowPlaying = () => {')
const transitionEnd = details.indexOf('const play = () => {', transitionStart)
const transitionBody = details.slice(transitionStart, transitionEnd)
if (transitionBody.includes('onClose()')) {
  throw new Error('Entering Now Playing must preserve the detail instead of destroying it')
}

requireText(actions, 'const player = useStationPlayer();', 'Action sheet must use the shared StationPlayer context')
requireText(actions, 'queued && action.intent === "play"', 'Only an explicit Play action should force the immersive transition')
requireText(actions, 'player.setQueueOpen(false);', 'Action-sheet Play must not leave the queue sheet over Now Playing')
requireText(actions, 'player.openNowPlaying();', 'Action-sheet Play must open Now Playing World')

requireText(player, 'const closeNowPlaying = useCallback(() => setNowPlayingOpen(false), []);', 'Closing Now Playing must remain overlay-only')
requireText(player, 'onClick={player.openNowPlaying}', 'The persistent player surface must still reopen Now Playing World')
requireText(player, 'const toggle = useCallback(async () => {', 'Mini-player transport must keep its independent toggle path')
if (/const toggle = useCallback[\s\S]{0,1800}openNowPlaying/.test(player)) {
  throw new Error('Mini-player play/pause must not force Now Playing World open')
}

console.log('now-playing-transition-tests: ok')
