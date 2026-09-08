
import fs from 'node:fs'

function read(path) { return fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8') }
function assert(condition, message) { if (!condition) throw new Error(message) }

const station = read('src/components/StationPlayer.tsx')
const page = read('src/app/admin/editorial/page.tsx')
const releases = read('src/components/ReleaseEditorialPanel.tsx')
const drawer = read('src/components/EditorialWorkDrawer.tsx')
const metadata = read('src/app/api/admin/editorial/catalogue-metadata/route.ts')
const editable = read('src/components/editorial/EditorialEditableIdentity.tsx')

const playNowStart = station.indexOf('const playNow = useCallback')
const playNextStart = station.indexOf('const playNext = useCallback', playNowStart)
assert(playNowStart >= 0 && playNextStart > playNowStart, 'Station player playNow block must exist')
assert(!station.slice(playNowStart, playNextStart).includes('setQueueOpen(true)'), 'Selecting Play must not auto-open the queue')
assert(station.includes('onClick={() => player.setQueueOpen(true)}'), 'Queue must remain explicitly user-openable')
assert(page.includes('EditorialConnectedPreview'), 'Singles and beats must use the connected Editorial preview')
assert(page.includes('EditorialEditableIdentity'), 'Singles and beats must expose inline public metadata editing')
assert(!page.includes('<audio controls preload="none" src={track.file_url}'), 'Singles must not use a standalone browser audio player')
assert(!page.includes('<audio controls preload="none" src={audioSrc}'), 'BeatStore review must not use a standalone browser audio player')
assert(!releases.includes('<audio controls preload="none" src={m.file_url}'), 'Album/EP track review must not use a standalone browser audio player')
assert(!drawer.includes('<audio controls preload="none" src={work.audio}'), 'Editorial work drawer must not use a standalone browser audio player')
assert(releases.includes('EditorialReleaseTrackTitleEditor'), 'Album/EP member tracks must expose visible title editing')
assert(editable.includes('PenIcon'), 'Editable Editorial title/artist fields must show a pen affordance')
assert(editable.includes('Existing BVS'), 'Editors must be shown the existing-profile relationship selector')
assert(metadata.includes("kind === 'beat'"), 'Catalogue metadata API must normalize beat metadata')
assert(metadata.includes('producer_user_id: linked.profile.id'), 'Beat normalization must update the BVS producer relationship')
assert(metadata.includes('beat_metadata_normalized'), 'Beat metadata relationship changes must be audited')
console.log('Editorial connected playback and inline edit assertions passed.')
