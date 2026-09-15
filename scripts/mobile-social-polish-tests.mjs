import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const assert = (condition, message) => { if (!condition) throw new Error(message) }

const feedList = read('src/components/feed/BvsFeedList.tsx')
const postsRoute = read('src/app/api/app/participation/posts/route.ts')
const share = read('src/components/app-vnext/AppShareButton.tsx')
const creatorPlayback = read('src/components/app-vnext/AppCreatorPlayback.tsx')
const creatorTracks = read('src/app/api/app/creator/[id]/tracks/route.ts')
const appCreator = read('src/app/app/[surface]/creator/[slug]/page.tsx')
const webCreator = read('src/app/artist/[slug]/page.tsx')
const notifications = read('src/lib/participation-notifications-server.ts')
const nativeRuntime = read('src/lib/app-native.ts')
const appDelegate = read('ios/App/App/AppDelegate.swift')
const entitlements = read('ios/App/App/App.entitlements')
const archiveScript = read('ops/store-launch/scripts/archive-ios.sh')
const apns = read('src/lib/apns-server.ts')
const pushDelivery = read('src/lib/participation-push-server.ts')

// Feed refresh is an in-place mobile interaction, not a document reload.
assert(feedList.includes('PULL_REFRESH_TRIGGER'), 'Feed must retain a deliberate pull-to-refresh threshold')
assert(feedList.includes('bvs:feed-refresh'), 'Feed refresh must publish a BVS refresh event')
assert(feedList.includes('router.refresh()'), 'Feed refresh must ask Next.js for fresh server feed data')
assert(feedList.includes('loadPosts(null, false)'), 'Feed refresh must reload community posts without reloading the player shell')
assert(!feedList.includes('window.location.reload'), 'Feed pull-to-refresh must not reload the whole app')

// Deleted root posts disappear from the social feed while direct-thread tombstones remain possible elsewhere.
assert(postsRoute.includes('message_kind=eq.root&status=eq.published'), 'Feed hydration must only include published root messages')
assert(!postsRoute.includes('message_kind=eq.root&status=in.(published,deleted)'), 'Deleted root messages must not hydrate Feed cards')
assert(postsRoute.includes('raw.startsWith("artist-")'), 'Following lane must normalize creator library keys')

// Story shares should be a designed 9:16 media asset with the actual artwork.
assert(share.includes('canvas.width = 1080') && share.includes('canvas.height = 1920'), 'Story cards must remain 1080x1920')
assert(share.includes('loadStoryImage(image)'), 'Story card renderer must load the shared artwork')
assert(share.includes('drawCoverImage(context, loaded.image, 72, 278, 936, 936, 54)'), 'Story artwork must dominate the story card')
assert(share.includes('OPEN ON BVS'), 'Story card must carry a visible BVS call to action')
assert(share.includes('new URL(src, "https://bvsradio.com")'), 'Relative share artwork must resolve against canonical BVS')
assert(!share.includes('window.location.origin'), 'Story media must not inherit preview/deployment origins')

// Artist-level playback uses only public approved catalogue rows and fails closed on mobile rights clearance.
assert(creatorPlayback.includes('player.playAll(tracks'), 'Creator Play must queue the creator catalogue in the persistent player')
assert(creatorPlayback.includes('Shuffle'), 'Creator profile must expose shuffle playback')
assert(creatorPlayback.includes('This track is not cleared for playback on this BVS surface.'), 'Per-track playback must fail closed when a mobile track is not cleared')
assert(creatorTracks.includes('is_public=eq.true&editorial_status=eq.approved'), 'Creator playback must use public Editorial-approved tracks only')
assert(creatorTracks.includes('mobile_distribution_clearances!inner(surface,status)'), 'Mobile creator playback must inner-join rights clearances')
assert(creatorTracks.includes('mobile_distribution_clearances.status=eq.cleared'), 'Mobile creator playback must require cleared distribution status')
assert(appCreator.includes('<AppCreatorPlayback creatorId={profile.id} creatorName={displayName} surface={surface} />'), 'Contained creator profiles must expose artist-level Play')
assert(webCreator.includes('<AppCreatorPlayback creatorId={profile.id} creatorName={profile.name} />'), 'Public creator profiles must expose artist-level Play')

// Community notifications should include followed creators as well as the pre-existing reply/mention/like/repost paths.
assert(notifications.includes('`${actorName} posted on BVS`'), 'Followers must receive a creator-post community notification')
assert(notifications.includes('`artist-${actorId}`'), 'Follower fanout must match creator library item keys')
assert(notifications.includes('event.event_type === "thread_liked"'), 'Like notifications must remain enabled')
assert(notifications.includes('event.event_type === "message_replied"'), 'Reply notifications must remain enabled')

// Native iOS push registration and deep-link handoff must be wired end-to-end.
assert(nativeRuntime.includes('bvsPushRegistration'), 'Web runtime must detect the native iOS push registration bridge')
assert(nativeRuntime.includes('bvs:native-push-action'), 'Web runtime must listen for native push taps')
assert(nativeRuntime.includes('/api/app/push/register'), 'Native token registration must persist through the BVS push API')
assert(appDelegate.includes('import UserNotifications'), 'iOS shell must include UserNotifications')
assert(appDelegate.includes('registerForRemoteNotifications()'), 'iOS shell must register with APNs after permission')
assert(appDelegate.includes('bvs:native-push-action'), 'iOS notification taps must be handed to the web runtime')
assert(appDelegate.includes('info["href"]'), 'iOS notification tap handling must preserve the deep-link href')
assert(entitlements.includes('<key>aps-environment</key>') && entitlements.includes('<string>production</string>'), 'Release entitlement must enable production APNs')
assert(archiveScript.includes('CODE_SIGN_ENTITLEMENTS=App/App.entitlements'), 'Release archive must sign with the APNs entitlement')

// BVS can deliver iOS notifications directly without adding a third-party provider dependency.
assert(apns.includes('alg: "ES256"'), 'APNs provider token must use Apple ES256 JWT authentication')
assert(apns.includes('https://api.push.apple.com'), 'Production APNs endpoint must be configured')
assert(apns.includes('BVS_APNS_PRIVATE_KEY'), 'APNs credentials must come from environment secrets')
assert(pushDelivery.includes('sendApnsPush'), 'Push queue must route iOS deliveries through direct APNs when configured')
assert(pushDelivery.includes('BadDeviceToken|Unregistered'), 'Invalid APNs tokens must be retired')

console.log('Mobile social polish assertions passed.')
