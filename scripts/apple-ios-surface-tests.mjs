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
const homeDiscovery = read('src/components/app-vnext/AppHomeDiscoverySections.tsx')
const layout = read('src/app/app/[surface]/layout.tsx')
const nav = read('src/components/app-vnext/AppBottomNav.tsx')
const bootstrap = read('src/components/app-vnext/AppBootstrap.tsx')
const appSession = read('src/components/app-vnext/AppSessionProvider.tsx')
const appTopBar = read('src/components/app-vnext/AppTopBar.tsx')
const appExplore = read('src/components/app-vnext/AppExploreClient.tsx')
const appBeatPreview = read('src/components/app-vnext/AppBeatPreviewPlayer.tsx')
const appShare = read('src/components/app-vnext/AppShareButton.tsx')
const appCreatorPage = read('src/app/app/[surface]/creator/[slug]/page.tsx')
const appShowPage = read('src/app/app/[surface]/show/[slug]/page.tsx')
const appPlaylistDetail = read('src/components/app-vnext/AppPlaylistDetailClient.tsx')
const appMarketplace = read('src/components/app-vnext/AppMarketplaceClient.tsx')
const flowActionSheet = read('src/components/flow/BvsActionSheet.tsx')
const shareCreator = read('src/components/ShareCreatorButton.tsx')
const webPlaylistDetail = read('src/components/library/PlaylistDetailView.tsx')
const shareUrl = read('src/lib/share-url.ts')
const appLibraryViewToggle = read('src/components/app-vnext/AppLibraryViewToggle.tsx')
const appExperienceStyle = read('src/components/app-vnext/AppExperienceStyle.tsx')
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
assert(!layout.includes('AppLibraryViewToggle'), 'Library view switch must not float over page content from the root layout')
assert(!layout.includes('AppScrollAssist'), 'native app must rely on the platform scroll indicator instead of a duplicate BVS scrollbar')
assert(!exists('src/components/app-vnext/AppScrollAssist.tsx'), 'duplicate native fast-scroll component must stay removed')
assert(nav.includes('grid-cols-5'), 'vNext must keep five bottom tabs')
for (const label of ['Home', 'Discover', 'Library', 'You']) {
  assert(nav.includes(`label: "${label}"`), `vNext bottom nav must contain ${label}`)
}
assert(nav.includes('isCreator ? "Studio" : "Create"'), 'vNext bottom nav must contain Create/Studio')
assert(nav.includes('bvs-app-bottom-nav'), 'bottom nav must use the base-anchored safe-area shell')
assert(nav.includes('bvs-app-bottom-nav-inner'), 'bottom nav controls must stay inside the safe-area inner rail')

// Mobile chrome refinements should stay consistent and useful across the app.
assert(appTopBar.includes('function MarketplaceIcon()'), 'marketplace must use a recognisable storefront icon')
assert(appTopBar.includes('function SearchIcon()'), 'search must use the shared-size magnifying glass icon')
assert(appTopBar.includes('className="h-6 w-6"'), 'top action icons must use one consistent visible size')
assert(appTopBar.includes('<AppLibraryViewToggle'), 'Library list/grid control must live in the header instead of overlapping filter chips')
assert(appLibraryViewToggle.includes('bvs.library.view.v1'), 'Library list/grid preference must persist locally')
assert(appLibraryViewToggle.includes('className="grid h-11 w-11'), 'Library view control must use the same header touch-target size')
assert(!appLibraryViewToggle.includes('role="scrollbar"'), 'Library view control must not recreate a native fast-scroll rail')
assert(appExperienceStyle.includes('inset-inline: 0 !important'), 'native persistent player must dock edge-to-edge')
assert(appExperienceStyle.includes('border-radius: 1.15rem 1.15rem 0 0 !important'), 'native persistent player must keep only its top corners rounded')
assert(appExperienceStyle.includes('button:first-child + a'), 'Library grid mode must target saved-media rows only')
assert(!appExperienceStyle.includes('.space-y-2:has(> article) {'), 'Library grid mode must not reshape action-heavy download rows')
assert(appExperienceStyle.includes('data-bvs-library-view="grid"'), 'Library grid preference must change saved-item presentation')

// Discover BeatStore previews must share the persistent audio path instead of creating a second native audio stream.
assert(appExplore.includes('AppBeatPreviewPlayer'), 'Discover beat cards must use the shared BeatStore preview player')
assert(!appExplore.includes('<audio controls preload="none" src={item.previewUrl}'), 'Discover beat cards must not render a standalone audio element')
assert(appBeatPreview.includes('useStationPlayer'), 'BeatStore preview control must use the persistent StationPlayer')
assert(appBeatPreview.includes('player.playNow(previewTrack'), 'BeatStore preview control must replace the current persistent recording')
assert(appBeatPreview.includes('player.toggle()'), 'BeatStore preview control must share persistent play/pause state')

// Social sharing must look consumer-grade and never leak preview/deployment hosts.
assert(shareUrl.includes('https://bvsradio.com'), 'all share URLs must use the canonical BVS origin')
for (const section of ['beat', 'creator', 'show', 'playlist', 'marketplace']) {
  assert(shareUrl.includes(`section === "${section}"`), `contained ${section} shares must map to a public web destination`)
}
assert(appShare.includes('canvas.width = 1080'), 'app social share must build a 1080-wide story card')
assert(appShare.includes('canvas.height = 1920'), 'app social share must build a 9:16 story card')
assert(appShare.includes('navigator.canShare?.({ files: [storyCard] })'), 'app share must send the story card through compatible native social share sheets')
assert(appShare.includes('bvsradio.com'), 'app share UI must identify the canonical public domain')
assert(!appShare.includes('window.location.origin'), 'app share button must not derive public links from a preview or WebView origin')
assert(appCreatorPage.includes('path={`/artist/'), 'creator shares must use the public artist route')
assert(!appCreatorPage.includes('App surface:'), 'creator profiles must not expose implementation surface labels')
assert(!appCreatorPage.includes('vNext navigation shell'), 'creator profiles must not expose vNext developer terminology')
assert(appShowPage.includes('path={`/shows/'), 'show shares must use the public show route')
assert(!appShowPage.includes('vNext notification layer'), 'show pages must not expose notification implementation terminology')
assert(!appShowPage.includes('isolated notification schema'), 'show pages must not expose schema implementation terminology')
assert(appPlaylistDetail.includes('path={`/playlist/'), 'app playlists must share public playlist URLs')
assert(!appPlaylistDetail.includes('window.location.origin}/app/'), 'app playlists must not share contained or preview origins')
assert(!appPlaylistDetail.includes('app surface'), 'playlist copy must not expose app-surface implementation language')
assert(flowActionSheet.includes('canonicalBvsShareUrl(object.route)'), 'Flow action shares must canonicalize their destination')
assert(shareCreator.includes('canonicalBvsShareUrl(window.location.href)'), 'web creator sharing must replace preview hosts with bvsradio.com')
assert(webPlaylistDetail.includes('canonicalBvsShareUrl(`/playlist/${id}`)'), 'web playlist sharing must use the canonical public URL')
assert(appMarketplace.includes('https://bvsradio.com/marketplace/'), 'marketplace sharing must remain pinned to the canonical web storefront')

// Home should remain the newer vNext experience and keep all contained links in the app namespace.
assert(home.includes('Music moves differently here.'), 'vNext home hero must remain current')
assert(home.includes('AppHomeStationCard'), 'vNext home must keep persistent station entry')
assert(home.includes('AppJoinCard'), 'vNext home must keep identity/join entry')
assert(home.includes('const base = `/app/${surface}`'), 'vNext home links must use the contained app namespace')
assert(home.includes('Suspense'), 'app home must stream non-critical discovery instead of blocking cold start')
assert(home.includes('AppHomeDiscoverySections'), 'app home must defer artist/show discovery behind the shell')
assert(!home.includes('getStationTracks(surface)'), 'app home shell must not block on the station catalogue during cold start')
assert(homeDiscovery.includes('withTimeout'), 'deferred home discovery must fail open after a bounded wait')
assert(homeDiscovery.includes('fairDailyOrder(artistRows, "artists")'), 'app home artists must use fair daily rotation instead of alphabetical order')
assert(exists('src/app/app/[surface]/loading.tsx'), 'app surface must ship a lightweight route loading state')
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

// Navigation must progressively enhance rather than capture-cancel contained links.
assert(bootstrap.includes('window.localStorage.setItem("bvs_app_version", "vnext")'), 'bootstrap must identify vNext shell')
assert(bootstrap.includes('url.pathname === `/app/${surface}` || url.pathname.startsWith(`/app/${surface}/`)'), 'bootstrap must recognize contained app routes')
assert(!bootstrap.includes('router.push(`${url.pathname}${url.search}${url.hash}`)'), 'contained app links must retain their native href fallback')
assert(bootstrap.includes('window.location.assign(destination)'), 'mapped legacy destinations must have a hard-navigation fallback')
assert(bootstrap.includes('isExternalLegalOrLicenceUrl(url)'), 'legal/licence destinations need external boundary')
assert(bootstrap.includes('window.open(externalBvsUrl(url), "_blank", "noopener,noreferrer")'), 'external legal/licence links must leave the WebView')
assert(externalBoundary.includes('bvsradio.com'), 'external boundary must target canonical BVS host')
assert(appMarketplace.includes('providerHref'), 'Marketplace providers must resolve to real href destinations')
assert(appMarketplace.includes('<Link href={serviceHref(provider.slug, item.id)}'), 'Marketplace service details must be real links')
assert(appMarketplace.includes('<Link href={serviceHref(provider.slug, item.id, true)}'), 'Marketplace availability must be a real link')
assert(!appMarketplace.includes('onClick={() => openService'), 'Marketplace navigation must not depend on JS-only buttons')
assert(appPlaylistDetail.includes('href={`/app/${surface}/library`}'), 'Playlist back navigation must keep an href fallback')
assert(appPlaylistDetail.includes('href={`/app/${surface}/explore`}'), 'Empty-playlist explore navigation must keep an href fallback')

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
