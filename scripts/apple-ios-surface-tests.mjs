import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

function exists(path) {
  return fs.existsSync(new URL(`../${path}`, import.meta.url))
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const station = read('src/lib/station-library.ts')
const beats = read('src/lib/beatstore-server.ts')
const home = read('src/app/app/[surface]/page.tsx')
const layout = read('src/app/app/[surface]/layout.tsx')
const nav = read('src/components/app-vnext/AppBottomNav.tsx')
const bootstrap = read('src/components/app-vnext/AppBootstrap.tsx')
const externalBoundary = read('src/lib/app-external-boundary.ts')
const boundary = read('src/components/MobileIosBoundary.tsx')
const capacitor = read('capacitor.config.ts')
const rootLayout = read('src/app/layout.tsx')

// Rights-sensitive audio remains fail-closed for mobile surfaces.
assert(station.includes('mobile_distribution_clearances!inner'), 'station must inner-join mobile clearance')
assert(station.includes('mobile_distribution_clearances.status=eq.cleared'), 'station must require cleared mobile status')
assert(station.includes('return surface ? [] : shuffleDaily(localFallback)'), 'mobile station must fail closed on missing/query failure')
assert(station.includes('!surface || track.src.startsWith("/")'), 'mobile station must reject absolute audio URLs')

const rightsFilters = beats.match(/rights_confirmed=eq\.true/g) || []
assert(rightsFilters.length >= 2, 'published BeatStore primary and fallback queries must both require rights_confirmed=true')

// vNext must remain the App Store surface; guard against reintroducing the old listener shell.
assert(layout.includes('@/components/app-vnext/AppBootstrap'), 'app layout must mount vNext bootstrap')
assert(layout.includes('@/components/app-vnext/AppBottomNav'), 'app layout must mount vNext bottom nav')
assert(layout.includes('<AppNativeRuntime'), 'app layout must mount native runtime')
assert(nav.includes('grid-cols-5'), 'vNext must keep five bottom tabs')
for (const label of ['Home', 'Discover', 'Library', 'You']) {
  assert(nav.includes(`label: "${label}"`), `vNext bottom nav must contain ${label}`)
}
assert(nav.includes('isCreator ? "Studio" : "Create"'), 'vNext bottom nav must contain Create/Studio')

// Home should remain the newer vNext experience and keep all contained links in the app namespace.
assert(home.includes('Music moves differently here.'), 'vNext home hero must remain current')
assert(home.includes('AppHomeStationCard'), 'vNext home must keep persistent station entry')
assert(home.includes('AppJoinCard'), 'vNext home must keep identity/join entry')
assert(home.includes('const base = `/app/${surface}`'), 'vNext home links must use the contained app namespace')
assert(!home.includes('BVS Radio, made for listening on the go.'), 'do not regress to the old mobile home')

// Navigation guard must preserve the app shell for contained routes and externalise legal/licence destinations.
assert(bootstrap.includes('window.localStorage.setItem("bvs_app_version", "vnext")'), 'bootstrap must identify vNext shell')
assert(bootstrap.includes('router.push(`${url.pathname}${url.search}${url.hash}`)'), 'contained app routes must use Next router')
assert(bootstrap.includes('isExternalLegalOrLicenceUrl(url)'), 'legal/licence destinations need external boundary')
assert(bootstrap.includes('window.open(externalBvsUrl(url), "_blank", "noopener,noreferrer")'), 'external legal/licence links must leave the WebView')
assert(externalBoundary.includes('bvsradio.com'), 'external boundary must target canonical BVS host')

// Native iOS wrapper remains constrained to the dedicated app surface.
assert(boundary.includes('Capacitor.getPlatform() === "ios"'), 'native route boundary must be iOS-specific')
assert(boundary.includes('window.location.replace(IOS_ROOT)'), 'native route boundary must fail closed to /app/ios')
assert(boundary.includes('openOutsideNativeShell'), 'non-app website links must be externalised')
assert(rootLayout.includes('<MobileIosBoundary />'), 'root layout must mount the native iOS boundary')
assert(!capacitor.includes('allowNavigation:'), 'native app must not whitelist broad navigation hosts')
assert(capacitor.includes('https://bvsradio.com/app/${mobileSurface}'), 'native server URL must remain the dedicated mobile surface')

// Critical five-tab destinations must exist so the shell cannot render dead navigation.
for (const path of [
  'src/app/app/[surface]/explore/page.tsx',
  'src/app/app/[surface]/library/page.tsx',
  'src/app/app/[surface]/studio/page.tsx',
  'src/app/app/[surface]/you/page.tsx',
]) {
  assert(exists(path), `${path} must exist`)
}

// The current web Beat/Lyrics workflow must survive app reconciliation.
assert(exists('src/app/beat/[id]/page.tsx'), 'web beat workspace must remain available')
assert(exists('src/components/beatstore/BeatWorkflow.tsx'), 'web beat writing workflow must remain available')

console.log('Apple iOS vNext hardening assertions passed.')
