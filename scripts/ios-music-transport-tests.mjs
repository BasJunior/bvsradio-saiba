import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync('src/components/app-vnext/AppNowPlayingBridge.tsx', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText;

const gateCompiled = ts.transpileModule(fs.readFileSync('src/lib/remote-music-transport.ts', 'utf8'), { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText;
function gateFor(window, clock = () => performance.now()) {
  const scope = { exports: {}, window, performance: { now: clock } };
  vm.runInNewContext(gateCompiled, scope);
  return scope.exports.runRemoteTrackCommand;
}

function mount({ nativeBridge = false, version, unsupportedSeek = false } = {}) {
  const timers = [];
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
    setTimeout(fn) { timers.push(fn); return timers.length; }, clearTimeout() {},
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
      if (name.includes('remote-music-transport')) return { runRemoteTrackCommand: gateFor(win) };
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
  timers.splice(0).forEach(fn => fn());
  return { handlers, messages, events, calls, flush: () => timers.splice(0).forEach(fn => fn()) };
}

for (const version of [undefined, 0, 1, 2]) {
  const app = mount({ nativeBridge: true, version });

  // Explicit WebKit music handlers must survive even with native targets.
  // Clearing all actions in v1/v2 used to restore the media-element defaults.
  assert.equal(typeof app.handlers.get('nexttrack'), 'function');
  assert.equal(typeof app.handlers.get('previoustrack'), 'function');
  assert.equal(typeof app.handlers.get('play'), 'function');
  assert.equal(typeof app.handlers.get('pause'), 'function');
  assert.equal(app.handlers.get('seekforward'), null, 'forward interval seeking must always be disabled');
  assert.equal(app.handlers.get('seekbackward'), null, 'backward interval seeking must always be disabled');
  assert.equal(app.handlers.get('seekto'), null, 'contained iOS lock-screen scrubbing stays disabled until a verified native build ships');

  if (Number(version || 0) < 1) {
    app.handlers.clear();
    app.events.get('bvs:app-resume')();
    app.flush();
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
// check. A parent rerender must preserve music actions in every native build.
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
  scope.runRemoteTrackCommand = gateFor(scope.window);
  vm.runInNewContext(transportEffect, scope);
  handlers.get('nexttrack')(); handlers.get('previoustrack')();
  handlers.get('play')(); handlers.get('pause')();
  assert.equal(calls.next, 1); assert.equal(calls.previous, 1);
  assert.equal(calls.play, 1); assert.equal(calls.pause, 1);
  vm.runInNewContext(transportEffect, scope);
  assert.equal(typeof handlers.get('nexttrack'), 'function', 'Parent effect must preserve every native generation’s next controls');
  assert.equal(handlers.get('seekforward'), null);
  assert.equal(handlers.get('seekbackward'), null);
  assert.equal(handlers.get('seekto'), null);

}

// One lock-screen tap delivered by both layers must advance exactly once,
// regardless of delivery order. Fast repeated taps from one source still work.
for (const sources of [['web', 'native'], ['native', 'web']]) {
  let time = 1000, count = 0;
  const run = gateFor({}, () => time);
  run('next', sources[0], () => count++);
  time += 20;
  run('next', sources[1], () => count++);
  assert.equal(count, 1, 'cross-source echo must not skip two tracks');
  run('next', sources[0], () => count++);
  assert.equal(count, 2, 'same-source repeated tap must remain responsive');
  run('previous', sources[1], () => count++);
  assert.equal(count, 3, 'different direction must never be swallowed');
  time += 400;
  run('previous', sources[0], () => count++);
  assert.equal(count, 4, 'later independent cross-source tap must be allowed');
}

for (const nativeFirst of [true, false]) {
  const app = mount({ nativeBridge: true, version: 1 });
  const nativeNext = () => app.events.get('bvs:native-media-command')({ detail: { command: 'next' } });
  const webNext = () => app.handlers.get('nexttrack')();
  (nativeFirst ? nativeNext : webNext)();
  (nativeFirst ? webNext : nativeNext)();
  assert.equal(app.calls.next, 1, 'actual bridge callbacks must share the same duplicate gate');
  assert.equal(app.calls.seek.length, 0);
}
console.log('iOS music transport passed: explicit track actions in all builds, no interval seeking, duplicate system taps handled once.');
