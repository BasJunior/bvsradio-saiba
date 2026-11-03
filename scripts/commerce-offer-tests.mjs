import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import React from 'react'
import * as jsx from 'react/jsx-runtime'
import TestRenderer, { act } from 'react-test-renderer'
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const events = []
let notify
let disconnected = 0
class Element { constructor(commercial) { this.commercial = commercial } closest() { return this.commercial ? this : null } }
class Observer {
  constructor(callback) { notify = callback }
  observe() {}
  disconnect() { disconnected++ }
}
const exports = {}
const code = ts.transpileModule(readFileSync('src/components/OfferAnalytics.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
vm.runInNewContext(code, { exports, Element, IntersectionObserver: Observer, require: name => {
  if (name === 'react') return React
  if (name === 'react/jsx-runtime') return jsx
  if (name === '@/lib/analytics') return { trackEvent: (...event) => events.push(event) }
  throw new Error(name)
}})
let tree
await act(async () => { tree = TestRenderer.create(React.createElement(exports.default, { id: 'mixing', kind: 'service', source: 'fixture' }, 'offer'), { createNodeMock: () => ({}) }) })
notify([{ isIntersecting: true, intersectionRatio: 0.1 }])
assert.equal(events.length, 0, 'mostly offscreen offers are not counted')
notify([{ isIntersecting: true, intersectionRatio: 0.5 }])
assert.equal(events[0][1].funnel_stage, 'offer_view')
assert.equal(disconnected, 1, 'observer stops after first impression')
const wrapper = tree.root.findByType('div')
wrapper.props.onClickCapture({ target: new Element(false) })
assert.equal(events.length, 1, 'playback and unrelated controls are not purchase clicks')
wrapper.props.onClickCapture({ target: new Element(true) })
assert.equal(events[1][1].funnel_stage, 'offer_click')
assert.equal(events[1][1].object_id, 'mixing')
await act(async () => tree.unmount())
assert.doesNotMatch(readFileSync('src/app/checkout/page.tsx', 'utf8'), /trackEvent\("checkout_complete"/, 'a pending client order cannot count as a paid sale')
console.log('Commerce offers: visibility threshold, commercial click filtering, item attribution, cleanup and pending-payment regression passed.')
