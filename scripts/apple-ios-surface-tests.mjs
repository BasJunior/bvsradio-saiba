import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const station = read('src/lib/station-library.ts')
const beats = read('src/lib/beatstore-server.ts')
const edition = read('src/lib/app-edition-data.ts')
const mobile = read('src/lib/mobile-app.ts')
const home = read('src/app/app/[surface]/page.tsx')
const explore = read('src/components/app/AppExploreView.tsx')
const builders = read('src/lib/bvs-object-builders.ts')
const boundary = read('src/components/MobileIosBoundary.tsx')
const actionSheet = read('src/components/flow/BvsActionSheet.tsx')
const capacitor = read('capacitor.config.ts')
const rootLayout = read('src/app/layout.tsx')

assert(station.includes('mobile_distribution_clearances!inner'), 'station must inner-join mobile clearance')
assert(station.includes('mobile_distribution_clearances.status=eq.cleared'), 'station must require cleared mobile status')
assert(station.includes('return surface ? [] : shuffleDaily(localFallback)'), 'mobile station must fail closed on missing/query failure')
assert(station.includes('!surface || track.src.startsWith("/")'), 'mobile station must reject absolute audio URLs')

const rightsFilters = beats.match(/rights_confirmed=eq\.true/g) || []
assert(rightsFilters.length >= 2, 'published BeatStore primary and fallback queries must both require rights_confirmed=true')
assert(edition.includes('resolved.startsWith("/")'), 'app BeatStore preview/art must resolve to first-party media')
assert(edition.includes('if (!activePrices.length) return []'), 'app BeatStore must omit listings without active priced licences')
assert(mobile.includes('resolved.startsWith("/")'), 'mobile detail media must be first-party only')
assert(mobile.includes('.filter((beat) => beat.licences.length > 0)'), 'mobile BeatStore details must fail closed without active licences')

assert(home.includes('AppListenHero'), 'listener-shell hero must remain in the hardened home')
assert(home.includes('AppSceneTrail'), 'listener-shell scene trail must remain in the hardened home')
assert(home.includes('AppRail'), 'listener-shell rails must remain in the hardened home')
assert(!home.includes('BVS Radio, made for listening on the go.'), 'do not regress to the old main-line mobile home')
assert(home.includes('creatorToObject(creator, { surface })'), 'home creator links must stay inside the app namespace')
assert(home.includes(`/app/${'${surface}'}/account`), 'home account link must stay inside the app namespace')

assert(!explore.includes('/api/releases/public'), 'native Explore must not pull the broad release catalogue')
assert(!explore.includes('fetch("/api/artists"'), 'native Explore must not pull the broad artist directory')
assert(builders.includes('/track/${encodeURIComponent(track.id)}'), 'mobile tracks need contained detail routes')
assert(builders.includes('/beat/${encodeURIComponent(beat.id)}'), 'mobile beats need contained detail routes')
assert(builders.includes('/artist/${encodeURIComponent(creator.username)}'), 'mobile creators need contained profile routes')

for (const forbidden of ['p.scdn.co', 'music.youtube.com', 'open.spotify.com']) {
  assert(!home.includes(forbidden), `mobile home must not embed ${forbidden}`)
  assert(!explore.includes(forbidden), `mobile Explore must not embed ${forbidden}`)
}

assert(boundary.includes('Capacitor.getPlatform() === "ios"'), 'native route boundary must be iOS-specific')
assert(boundary.includes('window.location.replace(IOS_ROOT)'), 'native route boundary must fail closed to /app/ios')
assert(boundary.includes('openOutsideNativeShell'), 'non-app website links must be externalised')
assert(actionSheet.includes('openOutsideNativeIosShell(action.href)'), 'action-sheet website links must use the native iOS external handoff')
assert(actionSheet.includes('window.open(url.toString(), "_blank", "noopener,noreferrer")'), 'native iOS action-sheet handoff must create a system-openable navigation')
assert(rootLayout.includes('<MobileIosBoundary />'), 'root layout must mount the native iOS boundary')
assert(!capacitor.includes('allowNavigation:'), 'Build 3 must not whitelist broad navigation hosts')
assert(capacitor.includes('https://bvsradio.com/app/${mobileSurface}'), 'native server URL must remain the dedicated mobile surface')

console.log('Apple iOS live-lineage hardening assertions passed.')
