import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const assert = (condition, message) => { if (!condition) throw new Error(message) }

const library = read('src/lib/library.ts')
const appBridge = read('src/components/app-vnext/AppLibrarySyncBridge.tsx')
const webSync = read('src/components/LibrarySyncProvider.tsx')

assert(library.includes("bvs.library.cache-owner.v1"), 'library cache must carry an account owner marker')
assert(library.includes('export function clearLibraryCache()'), 'library cache must have an explicit clearing primitive')
assert(library.includes('export function setLibraryCacheOwner'), 'library cache owner must be writable by auth sync')
assert(library.includes('export function getLibraryCacheOwner'), 'library cache owner must be readable by auth sync')

assert(appBridge.includes('userId: string'), 'pending app library mutations must be bound to a user id')
assert(appBridge.includes('op.userId !== userId'), 'app sync must refuse to send a queued mutation for another account')
assert(appBridge.includes('if (getLibraryCacheOwner() || previousUser) clearLibraryCache()'), 'signed-out app state must clear account-owned and legacy synced library data')
assert(appBridge.includes('window.localStorage.removeItem(lastUserKey)'), 'sign-out must remove the legacy app owner marker after clearing')
assert(appBridge.includes('setLibraryCacheOwner(payload.userId)'), 'successful app hydration must mark local library data with the authenticated account')
assert(appBridge.includes('payload.userId !== userId'), 'app hydration must reject a mismatched account response')

assert(webSync.includes('owner && owner !== userId'), 'web sync must clear a cache that belongs to another account before merging')
assert(webSync.includes('if (!hasSession && getLibraryCacheOwner()) clearLibraryCache()'), 'web signed-out state must clear account-owned library data')
assert(webSync.includes('if (getLibraryCacheOwner()) clearLibraryCache()'), 'web auth sign-out must clear the account cache')
assert(webSync.includes('applyRemote(result.libraries, result.userId)'), 'web remote hydration must associate cache data with the active account')

console.log('Library session-isolation assertions passed.')
