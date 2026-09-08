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
const appSession = read('src/components/app-vnext/AppSessionProvider.tsx')
const appTopBar = read('src/components/app-vnext/AppTopBar.tsx')
const nativeRuntime = read('src/components/app-vnext/AppNativeRuntime.tsx')
const nowPlayingBridge = read('src/components/app-vnext/AppNowPlayingBridge.tsx')
const accessRoute = read('src/app/api/auth/access/route.ts')
const externalBoundary = read('src/lib/app-external-boundary.ts')
const boundary = read('src/components/MobileIosBoundary.tsx')
const buyButton = read('src/components/BuyTrackButton.tsx')
const buyHandoff = read('src/app/buy/[trackId]/page.tsx')
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
assert(layout.includes('<AppNowPlayingBridge'), 'app layout must mount foreground now-playing bridge')
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
assert(home.includes('fairDailyOrder(artistRows, "artists")'), 'app home artists must use fair daily rotation instead of alphabetical order')
assert(!home.includes('BVS Radio, made for listening on the go.'), 'do not regress to the old mobile home')

// Signed-in app identity must show the saved profile image, or the profile name/username initial when no image exists.
assert(accessRoute.includes('select=role,is_producer,username,display_name,avatar_url'), 'app access payload must load profile identity fields')
assert(accessRoute.includes('profileAvatarUrl'), 'app access payload must return the saved profile avatar')
assert(accessRoute.includes('profileDisplayName'), 'app access payload must return profile display name')
assert(accessRoute.includes('profileUsername'), 'app access payload must return profile username')
assert(accessRoute.includes("!normalizedAvatarUrl.includes('default-avatar')"), 'default avatar placeholder must fall back to the profile initial')
assert(appSession.includes('setAvatarUrl(payload.profileAvatarUrl || null)'), 'app session must hydrate the saved profile avatar')
assert(appSession.includes('setProfileDisplayName(payload.profileDisplayName || null)'), 'app session must hydrate the profile display name')
assert(appSession.includes('setProfileUsername(payload.profileUsername || null)'), 'app session must hydrate the profile username')
assert(appTopBar.includes('profileDisplayName ||'), 'app header initial must prefer the profile display name')
assert(appTopBar.includes('profileUsername ||'), 'app header initial must fall back to the profile username')

// iPhone system chrome must not cover the BVS header.
assert(appTopBar.includes('env(safe-area-inset-top)'), 'app header must include the iPhone top safe area')
assert(layout.includes('--bvs-header-height'), 'app content must be offset by measured header height')
assert(nativeRuntime.includes('StatusBar.setOverlaysWebView({ overlay: false })'), 'native iOS WebView must sit below the system status area')

// Foreground iOS playback must publish richer Media Session state immediately and feed the native bridge when the binary supports it.
assert(nowPlayingBridge.includes('navigator.mediaSession.setPositionState'), 'app must keep foreground Media Session position current')
assert(nowPlayingBridge.includes('bvsNowPlaying'), 'app must publish now-playing state to the native iOS bridge when available')

// Player Buy must leave the App Store WebView and carry the exact recording into web checkout.
assert(buyButton.includes('`/buy/${encodeURIComponent(trackId)}`'), 'player Buy must target an exact-track web purchase handoff')
assert(buyHandoff.includes('upsertTrackCartLine'), 'web purchase handoff must place the selected recording in checkout')
assert(buyHandoff.includes('window.location.replace("/checkout")'), 'exact-track handoff must continue to canonical checkout')

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
