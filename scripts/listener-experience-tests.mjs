import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const jsx = (type, props) => ({ type, props });
async function component(path, imports, globals = {}) {
  const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, ...globals, require(name) {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name in imports) return imports[name];
    throw Error(`Unexpected import ${name}`);
  } });
  return exports.default;
}
function nodes(node) {
  if (!node || typeof node !== 'object') return [];
  if (typeof node.type === 'function') return nodes(node.type(node.props));
  return [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
}
const actions = [];
let timeline = { elapsed: 50, duration: 200 };
const player = {
  current: { title: 'First', artist: 'Creator', artwork: '/cover.jpg' },
  upNext: [{ track: { title: 'Next', artist: 'Another creator' } }],
  toggle: () => actions.push('toggle'), next: () => actions.push('next'),
  openNowPlaying: () => actions.push('full'), setQueueOpen: value => actions.push(value),
  seek: ratio => actions.push(ratio), error: null,
};
const Home = await component('src/components/HomeListenPanel.tsx', {
  react: { useState: initial => [initial, () => {}] },
  '@/components/StationPlayer': { useStationPlayer: () => player, useStationPlayerProgress: () => timeline },
  '@/components/flow/FlowRelationships': { default: 'relationships' },
  '@/components/BvsSignalPanel': { default: 'signal' },
  '@/components/home/HomeArtistNote': { default: 'artist-note' },
});
let tree = nodes(Home());
for (const label of ['Play BVS rotation', 'Next recording', 'Open full player']) {
  tree.find(node => node.props?.['aria-label'] === label).props.onClick();
}
assert.deepEqual(actions, ['toggle', 'next', 'full']);
const slider = tree.find(node => node.type === 'input');
assert.equal(slider.props.value, 50);
assert.equal(slider.props['aria-valuetext'], '0:50 of 3:20');
slider.props.onChange({ target: { value: '100' } });
assert.equal(actions.at(-1), 0.5);
player.error = 'The recording is unavailable';
assert.equal(nodes(Home()).find(node => node.props?.role === 'alert').props.children, player.error);
timeline = { elapsed: Infinity, duration: NaN };
player.current = undefined;
tree = nodes(Home());
assert.equal(tree.find(node => node.type === 'input').props.disabled, true);
assert.equal(tree.find(node => node.props?.['aria-label'] === 'Play BVS rotation').props.disabled, true);

let effect, intersection, mutation, cleanup, active;
let intersectionDisconnected = false, mutationDisconnected = false;
const ids = ['radio-on-air', 'radio-session', 'radio-context', 'radio-coming-up', 'radio-shows'];
const elements = new Map(ids.slice(0, 2).map(id => [id, { id }]));
const observed = [];
const Nav = await component('src/components/RadioShelfNav.tsx', {
  react: { useState: value => [value, next => { active = next; }], useEffect: fn => { effect = fn; } },
}, {
  document: { getElementById: id => id === 'bvs-main-content' ? {} : elements.get(id) },
  IntersectionObserver: class {
    constructor(callback) { intersection = callback; }
    observe(element) { observed.push(element.id); }
    disconnect() { intersectionDisconnected = true; }
  },
  MutationObserver: class {
    constructor(callback) { mutation = callback; }
    observe() {}
    disconnect() { mutationDisconnected = true; }
  },
});
Nav(); cleanup = effect();
assert.equal(observed.length, 2);
for (const id of ids.slice(2)) elements.set(id, { id });
mutation();
assert.deepEqual(observed, ids, 'Streamed sections must join scroll tracking');
assert.equal(mutationDisconnected, true, 'Stop watching mutations once all shelves exist');
intersection([{ target: { id: ids[0] }, isIntersecting: true, intersectionRatio: 0.5 }]);
intersection([{ target: { id: ids[1] }, isIntersecting: true, intersectionRatio: 0.2 }]);
assert.equal(active, ids[0], 'A weaker changed entry must not replace a more visible section');
intersection([{ target: { id: ids[0] }, isIntersecting: false, intersectionRatio: 0 }]);
assert.equal(active, ids[1]);
cleanup(); assert.equal(intersectionDisconnected, true);

let surface = null;
const Recovery = await component('src/components/recovery/RecoveryPanel.tsx', {
  'next/link': { default: 'link' },
  '@/components/app/AppSurfaceProvider': { useAppSurface: () => ({ surface, appChrome: Boolean(surface) }) },
});
for (surface of [null, 'ios', 'android']) {
  const links = nodes(Recovery({ missing: true })).filter(node => node.type === 'link');
  assert.equal(links[0].props.href, surface ? `/app/${surface}` : '/');
  assert.equal(links[1].props.href, surface ? `/app/${surface}/explore` : '/search');
}
console.log('Listener experience passed: player controls, finite seek, errors, streamed shelf tracking, cleanup and surface-safe recovery.');

// Exercise chart fallback and rotation without requesting production data.
async function chartFixture(entries, reducedMotion = false) {
  const slots = [], effects = [], intervals = new Map();
  let index = 0, sequence = 0;
  const react = {
    useState(initial) { const position = index++; if (!(position in slots)) slots[position] = initial; return [slots[position], value => { slots[position] = typeof value === 'function' ? value(slots[position]) : value; }]; },
    useEffect(fn, deps) { const position = index++, previous = slots[position]; if (!previous || deps.some((value, n) => value !== previous.deps[n])) effects.push(() => { previous?.cleanup?.(); slots[position] = { deps, cleanup: fn() }; }); },
  };
  const Chart = await component('src/components/home/HomeTopFive.tsx', {
    react, 'next/link': { default: 'link' },
    '@/lib/discovery': { discoveryItems: [1, 2].map(n => ({ id: `pick-${n}`, kind: 'track', title: `Pick ${n}`, subtitle: 'Creator', image: '/pick.jpg', href: '/search' })) },
    '@/components/StationPlayer': { useStationPlayer: () => ({ tracks: [] }) },
  }, {
    AbortController,
    fetch: async () => ({ ok: true, json: async () => ({ entries }) }),
    window: {
      setTimeout: () => ++sequence, clearTimeout() {},
      setInterval: callback => { const id = ++sequence; intervals.set(id, callback); return id; },
      clearInterval: id => intervals.delete(id),
      matchMedia: () => ({ matches: reducedMotion, addEventListener() {}, removeEventListener() {} }),
    },
    document: { hidden: false, addEventListener() {}, removeEventListener() {} },
  });
  const render = () => { index = 0; const tree = nodes(Chart()); effects.splice(0).forEach(fn => fn()); return tree; };
  render(); await new Promise(resolve => setImmediate(resolve));
  return { render, intervals, cleanup: () => slots.forEach(slot => slot?.cleanup?.()) };
}
const fallbackChart = await chartFixture([]);
let chart = fallbackChart.render();
assert(chart.some(node => node.props?.id === 'home-top-five-title' && node.props.children === 'Discover your next favourite'));
assert(!chart.some(node => typeof node.props?.children === 'string' && /^#\d/.test(node.props.children)), 'Fallback picks must never invent chart ranks');
assert.equal(fallbackChart.intervals.size, 1);
chart.find(node => node.type === 'section').props.onMouseEnter();
chart = fallbackChart.render();
assert.equal(fallbackChart.intervals.size, 0, 'Hover must pause chart movement');
chart.find(node => node.type === 'section').props.onMouseLeave();
chart = fallbackChart.render();
assert.equal(fallbackChart.intervals.size, 1);
chart.find(node => node.props?.['aria-label'] === 'Show 2 of 2, Pick 2').props.onClick();
chart = fallbackChart.render();
assert.equal(fallbackChart.intervals.size, 0, 'Manual selection must stop automatic movement');
assert(chart.some(node => node.props?.['aria-label'] === 'Resume chart rotation'));
fallbackChart.cleanup();
const rankedChart = await chartFixture([{ id: 'chart-1', title: 'Chart song', artist: 'Creator', rank: 1 }]);
chart = rankedChart.render();
assert(chart.some(node => node.props?.id === 'home-top-five-title' && node.props.children === 'Top 5 this week'));
assert(chart.some(node => node.props?.children === '#1'));
rankedChart.cleanup();
console.log('Chart behavior passed: honest fallback, published ranks, usable controls and rotation cancellation.');

const reducedChart = await chartFixture([], true);
reducedChart.render();
assert.equal(reducedChart.intervals.size, 0, 'Reduced motion must disable automatic rotation');
reducedChart.cleanup();
