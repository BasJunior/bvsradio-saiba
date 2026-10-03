import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const jsx = (type, props) => ({ type, props })
function load(path, imports, globals = {}) {
  const exports = {}
  const source = readFileSync(path, 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  vm.runInNewContext(code, { exports, require: name => {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' }
    if (name in imports) return imports[name]
    throw new Error(`Unexpected import: ${name}`)
  }, console, ...globals }, { filename: path })
  return exports
}
let effects = [], destinations = [], events = []
const react = { useState: value => [typeof value === 'function' ? value() : value, () => {}], useEffect: fn => effects.push(fn), useMemo: fn => fn() }
const studio = load('src/app/creator/studio/page.tsx', {
  react, 'next/link': { default: 'link' }, 'next/navigation': { useRouter: () => ({ replace: href => destinations.push(href) }) },
  '@/lib/use-browser-session': { useBrowserSession: () => ({ session: null, loading: false }) },
  '@/lib/use-account-json': { useAccountJson: () => ({ data: null, error: '', reload() {} }) },
  '@/lib/supabase': { isSupabaseConfigured: () => false }, '@/lib/analytics': { trackEvent: () => {} },
}, { window: { location: { hash: '#insights' } } })
studio.default(); effects.forEach(fn => fn())
assert.deepEqual(destinations, ['/creator/studio/manage#insights'], 'Legacy Studio navigation must use the router without replacing the document')
effects = []
const eventName = 'bvs:editorial-metadata-saved'
const identity = load('src/components/editorial/EditorialEditableIdentity.tsx', {
  react: { ...react, useState: value => [typeof value === 'boolean' ? true : value, () => {}] },
  '@/lib/editorial-events': { EDITORIAL_METADATA_SAVED_EVENT: eventName },
  '@/lib/supabase': { createClient: () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'test-only' } } }) } }) },
  '@/lib/public-name': { creatorPublicName: () => 'Artist', producerPublicName: () => 'Producer' },
}, { window: { dispatchEvent: event => events.push(event) }, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail } }, fetch: async () => ({ ok: true, json: async () => ({}) }) })
function find(node, label) {
  if (!node || typeof node !== 'object') return null
  if (node.type === 'button' && node.props.children === label) return node
  for (const child of [node.props?.children].flat(Infinity)) { const result = find(child, label); if (result) return result }
  return null
}
for (const [component, props, buttonLabel] of [
  [identity.default, {kind:'track',id:'track-1',title:'Title',artist:'Artist',profiles:[],editable:true}, 'Saving…'],
  [identity.EditorialReleaseTrackTitleEditor, {releaseId:'release-1',releaseTrackId:'member-1',releaseTitle:'Album',releaseArtist:'Artist',title:'Song',editable:true}, '…'],
]) {
  const tree=component(props)
  const button=find(tree,buttonLabel) || find(tree,'Save')
  assert.ok(button, 'Editor must expose a save action')
  button.props.onClick()
  await new Promise(resolve=>setImmediate(resolve))
}
assert.equal(events.length,2)
assert.equal(events[0].type,eventName)
assert.equal(events[0].detail.kind,'track')
assert.equal(events[1].detail.kind,'release')
const player=readFileSync('src/components/StationPlayer.tsx','utf8')
const refill=player.slice(player.indexOf('const fillUpNext ='),player.indexOf('// Hydrate + seed'))
const advance=player.slice(player.indexOf('const advance ='),player.indexOf('const handleMediaError ='))
assert.ok(!refill.includes('editorialPageRef.current'), 'Visiting Editorial must not disable station queue refill')
assert.ok(!advance.includes('editorialPageRef.current'), 'Visiting Editorial must not disable station track advancement')
assert.ok(player.includes('editorialHoldRef.current || isEditorialPlay(seed)'), 'Explicit private review must retain its autoplay boundary')
console.log('Workspace playback tests passed: Studio router shortcut, successful metadata saves refresh in place, station continuity and explicit-review boundaries.')
