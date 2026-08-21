import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const station = read('src/lib/station-library.ts')
const beats = read('src/lib/beatstore-server.ts')
const mobile = read('src/lib/mobile-app.ts')
const home = read('src/app/app/[surface]/page.tsx')
const boundary = read('src/components/MobileIosBoundary.tsx')
const capacitor = read('capacitor.config.ts')

assert(station.includes('mobile_distribution_clearances!inner'), 'station must inner-join mobile clearance')
assert(station.includes('mobile_distribution_clearances.status=eq.cleared'), 'station must require cleared mobile status')
assert(station.includes('return surface ? [] : shuffleDaily(localFallback)'), 'mobile station must fail closed on missing/query failure')
assert(station.includes('!surface || t.src.startsWith("/")'), 'mobile station must reject absolute third-party audio URLs')

const rightsFilters = beats.match(/rights_confirmed=eq\.true/g) || []
assert(rightsFilters.length >= 2, 'published BeatStore primary and fallback queries must both require rights_confirmed=true')
assert(mobile.includes('resolved.startsWith("/")'), 'mobile BeatStore media must be first-party only')
assert(mobile.includes('.filter((beat) => beat.licences.length > 0)'), 'mobile BeatStore must fail closed without active licences')

for (const forbidden of ['p.scdn.co', 'music.youtube.com', 'open.spotify.com']) {
  assert(!home.includes(forbidden), `mobile home must not embed ${forbidden}`)
}
assert(home.includes('/track/'), 'mobile home must keep track detail inside app namespace')
assert(home.includes('/beat/'), 'mobile home must keep beat detail inside app namespace')
assert(home.includes('/artist/'), 'mobile home must keep creator detail inside app namespace')
assert(home.includes('/account'), 'mobile home must keep account inside app namespace')

assert(boundary.includes('Capacitor.getPlatform() === "ios"'), 'native route boundary must be iOS-specific')
assert(boundary.includes('window.location.replace(IOS_ROOT)'), 'native route boundary must fail closed to /app/ios')
assert(boundary.includes('openOutsideNativeShell'), 'non-app website links must be externalised')
assert(!capacitor.includes('allowNavigation:'), 'Build 3 must not whitelist broad navigation hosts')
assert(capacitor.includes('https://bvsradio.com/app/${mobileSurface}'), 'native server URL must remain the dedicated mobile surface')

console.log('Apple iOS surface hardening assertions passed.')
