import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync('src/components/app-vnext/AppNowPlayingBridge.tsx', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText;

function mount({ nativeBridge = false, version, unsupportedSeek = false } = {}) {
  const effects = [], handlers = new Map(), messages = [], events = new Map();
  const calls = { next: 0, previous: 0, seek: [] };
  const player = {
    current: { id: 'song-a', src: '/a.mp3', title: 'Song A' },
    upNext: [{ id: 'song-b' }], history: [{ id: 'song-c' }],
    mode: 'station', autoplay: true, isPlaying: true,
    next: () => calls.next++, previous: () => calls.previous++,
    seekTo: value => calls.seek.push(value), play() {}, pause() {},
  };
  const win = {
    location: { origin: 'https://bvsradio.com' },
    __bvsNativeMusicControlsVersion: version,
    ...(nativeBridge ? { webkit: { messageHandlers: { bvsNowPlaying: {
      postMessage: payload => messages.push(payload),
    } } } } : {}),
    setTimeout(fn) { fn(); return 1; }, clearTimeout() {},
    addEventListener(name, fn) { events.set(name, fn); }, removeEventListener() {},
  };
  const scope = {
    exports: {}, window: win, URL,
    navigator: { mediaSession: {
      setPositionState() {},
      setActionHandler(action, handler) {
        if (unsupportedSeek && action === 'seekto') throw new Error('Unsupported');
        handlers.set(action, handler);
      },
    } },
    require(name) {
      if (name === 'react') return { useEffect: fn => effects.push(fn), useRef: value => ({ current: value }) };
      if (name === '@capacitor/core') return { Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios' } };
      if (name.includes('StationPlayer')) return { useStationPlayer: () => player, useStationPlayerProgress: () => ({ elapsed: 38, duration: 150 }) };
      if (name.includes('beat-playback')) return { isBeatTrack: () => false, isEditorialPlay: () => false };
      throw new Error(`Unexpected import: ${name}`);
    },
  };
  vm.runInNewContext(compiled, scope);
  scope.exports.default();
  effects.forEach(fn => fn());
  return { handlers, messages, events, calls };
}

for (const version of [undefined, 0, 1]) {
  const app = mount({ nativeBridge: true, version });
  assert.equal(app.handlers.size, version === 1 ? 0 : 5,
    'Metadata-only native bridge must retain the previously working WebKit music controls');
  if (version !== 1) {
    assert.equal(app.handlers.get('seekforward'), null);
    assert.equal(app.handlers.get('seekbackward'), null);
    app.handlers.clear();
    app.events.get('bvs:app-resume')();
    assert.equal(typeof app.handlers.get('nexttrack'), 'function', 'Resume must restore next track');
    assert.equal(typeof app.handlers.get('previoustrack'), 'function', 'Resume must restore previous track');
  }
  assert.equal(app.messages.find(m => m.action === 'update').canSeek, version === 1,
    'Legacy binary must receive canSeek=false so it cannot enable interval skip');
  assert.equal(app.messages.at(-1).action, version === 1 ? 'position' : 'update',
    'Legacy heartbeat must reassert music command availability');
  if (version !== 1) assert.equal(app.messages.at(-1).canSeek, false);
  app.events.get('bvs:native-media-command')({ detail: { command: 'next' } });
  app.events.get('bvs:native-media-command')({ detail: { command: 'previous' } });
  assert.equal(app.calls.next, 1);
  assert.equal(app.calls.previous, 1);
  assert.equal(app.calls.seek.length, 0, 'Track commands must not seek by seconds');
}
const fallback = mount({ unsupportedSeek: true });
assert.equal(fallback.handlers.get('seekforward'), null);
assert.equal(fallback.handlers.get('seekbackward'), null);
fallback.handlers.get('nexttrack')();
fallback.handlers.get('previoustrack')();
assert.equal(fallback.calls.next, 1);
assert.equal(fallback.calls.previous, 1);
assert.equal(fallback.calls.seek.length, 0);
console.log('iOS music transport: native ownership, old-binary compatibility and WebKit fallback passed.');
