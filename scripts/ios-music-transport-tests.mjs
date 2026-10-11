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

for (const version of [undefined, 0, 1, 2]) {
  const app = mount({ nativeBridge: true, version });

  // Legacy metadata-only builds keep WebKit Previous/Next. Native transport
  // builds own Previous/Next themselves. Every contained iOS generation must
  // finish with all Media Session seek actions explicitly disabled.
  if (Number(version || 0) < 1) {
    assert.equal(typeof app.handlers.get('nexttrack'), 'function');
    assert.equal(typeof app.handlers.get('previoustrack'), 'function');
  } else {
    assert.equal(app.handlers.has('nexttrack'), false, 'native transport must keep exclusive Previous/Next ownership');
    assert.equal(app.handlers.has('previoustrack'), false, 'native transport must keep exclusive Previous/Next ownership');
  }
  assert.equal(app.handlers.get('seekforward'), null, 'forward interval seeking must always be disabled');
  assert.equal(app.handlers.get('seekbackward'), null, 'backward interval seeking must always be disabled');
  assert.equal(app.handlers.get('seekto'), null, 'contained iOS lock-screen scrubbing stays disabled until a verified native build ships');

  if (Number(version || 0) < 1) {
    app.handlers.clear();
    app.events.get('bvs:app-resume')();
    assert.equal(typeof app.handlers.get('nexttrack'), 'function', 'Resume must restore next track');
    assert.equal(typeof app.handlers.get('previoustrack'), 'function', 'Resume must restore previous track');
  }

  const update = app.messages.find(m => m.action === 'update');
  assert.equal(update.canSeek, false, 'no currently installed iOS binary may receive canSeek=true');
  assert.equal(app.messages.at(-1).action, 'update', 'heartbeat must reassert the music-only command policy');
  assert.equal(app.messages.at(-1).canSeek, false, 'heartbeat must keep ±15s controls disabled');

  app.events.get('bvs:native-media-command')({ detail: { command: 'next' } });
  app.events.get('bvs:native-media-command')({ detail: { command: 'previous' } });
  assert.equal(app.calls.next, 1);
  assert.equal(app.calls.previous, 1);
  assert.equal(app.calls.seek.length, 0, 'Track commands must not seek by seconds');

  app.events.get('bvs:native-media-command')({ detail: { command: 'skip-forward', interval: 15 } });
  app.events.get('bvs:native-media-command')({ detail: { command: 'skip-backward', interval: 15 } });
  assert.equal(app.calls.next, 2, 'Legacy forward button must navigate to the next track');
  assert.equal(app.calls.previous, 2, 'Legacy backward button must use previous-track mechanics');
  assert.equal(app.calls.seek.length, 0, 'Legacy interval-command names must never perform interval seeks');

  app.events.get('bvs:native-media-command')({ detail: { command: 'seek', position: 72 } });
  assert.deepEqual(app.calls.seek, [72], 'explicit native seek messages remain separate from interval-skip buttons');
}

const fallback = mount({ unsupportedSeek: true });
assert.equal(fallback.handlers.get('seekforward'), null);
assert.equal(fallback.handlers.get('seekbackward'), null);
// Unsupported seekto must not prevent music navigation from being installed.
fallback.handlers.get('nexttrack')();
fallback.handlers.get('previoustrack')();
assert.equal(fallback.calls.next, 1);
assert.equal(fallback.calls.previous, 1);
assert.equal(fallback.calls.seek.length, 0);

// Execute the actual StationPlayer effect, not an imitation of its capability
// check. A parent rerender must not wipe the old-binary fallback installed by
// AppNowPlayingBridge, while capable binaries retain exclusive native ownership.
const stationSource = fs.readFileSync('src/components/StationPlayer.tsx', 'utf8');
const start = stationSource.indexOf('  // Keep browser / web-app lock-screen controls');
const end = stationSource.indexOf('\n  useEffect(() => {', start + stationSource.slice(start).indexOf('useEffect(() => {') + 1);
const transportEffect = ts.transpileModule(stationSource.slice(start, end), { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText;
for (const version of [undefined, 0, 1, 2]) {
  const handlers = new Map();
  const calls = { play: 0, pause: 0, next: 0, previous: 0, seek: [] };
  const scope = {
    useEffect: fn => fn(),
    Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios' },
    window: { __bvsNativeMusicControlsVersion: version, webkit: { messageHandlers: { bvsNowPlaying: {} } } },
    navigator: { mediaSession: { setActionHandler: (action, handler) => handlers.set(action, handler) } },
    play: () => calls.play++, pause: () => calls.pause++, seekTo: value => calls.seek.push(value),
    advance: direction => direction === 1 ? calls.next++ : calls.previous++,
  };
  vm.runInNewContext(transportEffect, scope);
  if (version >= 1) {
    assert.equal([...handlers.values()].every(handler => handler === null), true, 'Capable native binaries exclusively own commands');
  } else {
    handlers.get('nexttrack')(); handlers.get('previoustrack')();
    handlers.get('play')(); handlers.get('pause')();
    assert.equal(calls.next, 1); assert.equal(calls.previous, 1);
    assert.equal(calls.play, 1); assert.equal(calls.pause, 1);
    vm.runInNewContext(transportEffect, scope);
    assert.equal(typeof handlers.get('nexttrack'), 'function', 'Parent effect must preserve old-binary next controls');
    assert.equal(handlers.get('seekforward'), null);
    assert.equal(handlers.get('seekbackward'), null);
  }
}
console.log('iOS music transport: all contained-app seeking suppressed, track navigation preserved, legacy interval commands remapped.');
