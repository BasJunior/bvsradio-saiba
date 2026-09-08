import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const api = read('src/app/api/admin/editorial/catalogue-metadata/route.ts')
const client = read('src/components/editorial/EditorialCatalogueNormalizer.tsx')
const nav = read('src/components/EditorialWorkspaceNav.tsx')
const layout = read('src/app/layout.tsx')
const page = read('src/app/editorial/catalogue/page.tsx')

assert(api.includes("creatorPublicName"), 'metadata API must derive linked creator names from the approved BVS profile')
assert(api.includes("user_id: nextUserId"), 'metadata API must update the BVS creator relationship when a profile is selected')
assert(api.includes("track_metadata_normalized"), 'single metadata changes must be audited')
assert(api.includes("release_metadata_normalized"), 'release metadata changes must be audited')
assert(api.includes("release_tracks"), 'release track titles must be synchronized at source')
assert(api.includes("release_id=eq."), 'materialized release tracks must keep their public artist relationship synchronized')
assert(api.includes("preservedTrackIdentity: true"), 'single edits must preserve recording identity')
assert(api.includes("preservedReleaseIdentity: true"), 'release edits must preserve release identity')

assert(client.includes("useStationPlayer"), 'Editorial previews must route through the persistent BVS player')
assert(!client.includes('<audio'), 'Editorial normalization workspace must not create a second audio element')
assert(client.includes("Existing BVS profile"), 'Editors must be able to select an existing BVS creator profile')
assert(client.includes("Custom display name · keep current account relationship"), 'Free typing must remain an explicit fallback without silently breaking ownership')
assert(client.includes("Public track title"), 'Singles must expose editable public titles')
assert(client.includes("Public release title"), 'Albums and EPs must expose editable public release titles')
assert(client.includes("trackTitles"), 'Release member song titles must be editable')
assert(client.includes("bvs.editorial.catalogue.view.v1"), 'Web catalogue list/grid preference must persist')
assert(client.includes("['rotation', 'Rotation']"), 'Editors need a direct view of rotation tracks')

assert(page.includes('EditorialCatalogueNormalizer'), 'Editorial catalogue route must mount the normalization workspace')
assert(nav.includes('/editorial/catalogue'), 'Editorial navigation must expose catalogue normalization')
assert(layout.includes('<EditorialWorkspaceNav />'), 'Root editorial shell must mount workspace navigation')

console.log('Editorial catalogue normalization assertions passed.')
