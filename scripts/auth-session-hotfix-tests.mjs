import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')
const [supabase, login] = await Promise.all([
  read('src/lib/supabase.ts'),
  read('src/app/auth/login/page.tsx'),
])

assert.match(supabase, /let browserClient:/, 'browser auth client must be cached per tab')
assert.match(supabase, /if \(!browserClient\) browserClient = makeClient\(\)/, 'createClient must reuse the browser client')
assert.match(supabase, /if \(typeof window === "undefined"\) return makeClient\(\)/, 'server-side calls must not share a browser singleton')

assert.match(login, /withTimeout\(/, 'login session setup must have a timeout guard')
assert.match(login, /12000/, 'session setup timeout must prevent an indefinite spinner')
assert.match(login, /void fetch\('\/api\/auth\/profile'/, 'profile creation must remain best effort after auth succeeds')
assert.match(login, /window\.location\.assign\(nextPath \|\| '\/'\)/, 'successful login must fully rehydrate the authenticated shell')
assert.doesNotMatch(login, /await fetch\('\/api\/auth\/profile'/, 'best-effort profile sync must not block login navigation')

console.log('Production auth session hotfix contract: ok')
