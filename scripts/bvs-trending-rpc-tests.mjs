import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
let response
const exports = {}
const source = ts.transpileModule(fs.readFileSync('src/lib/trending-server.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
vm.runInNewContext(source, {
  exports,
  require(name) { if (name === '@/lib/creator-server') return { creatorHeaders: {}, creatorUrl: path => path }; return {} },
  process: { env: { SUPABASE_SERVICE_ROLE_KEY: 'fixture', NEXT_PUBLIC_SUPABASE_URL: 'https://fixture.invalid' } },
  fetch: async () => response,
  AbortSignal,
})
response = new Response(null, { status: 204 })
assert.equal(await exports.trendingRpc('bvs_trending_event', {}), null, 'void event RPC succeeds without a JSON body')
response = new Response('', { status: 200 })
assert.equal(await exports.trendingRpc('bvs_refresh_trending', {}), null, 'empty successful refresh does not become a 503')
response = Response.json({ entries: [] })
assert.equal(JSON.stringify(await exports.trendingRpc('bvs_trending_board', {})), JSON.stringify({ entries: [] }))
response = new Response(null, { status: 503 })
await assert.rejects(() => exports.trendingRpc('bvs_trending_board', {}), /unavailable/)
console.log('Trending RPC: void 204, empty success, JSON board and failure handling passed.')
