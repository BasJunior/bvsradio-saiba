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

assert.match(login, /withAuthTimeout\(/, 'login session setup must have a timeout guard')
assert.match(login, /12000/, 'session setup timeout must prevent an indefinite spinner')
assert.match(login, /signal: AbortSignal.timeout\(5000\)/, 'optional profile sync must have a bounded deadline')
assert.match(login, /\.catch\(\(\) => null\)/, 'profile sync must remain best effort')
assert.match(login, /window\.location\.assign\(nextPath === '\/' \? profileDestination : nextPath\)/, 'login must retain role-aware landing and full shell rehydration')
console.log('Production auth session hotfix contract: ok')
