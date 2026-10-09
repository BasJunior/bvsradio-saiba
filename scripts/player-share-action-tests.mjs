import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const requests = [];
const source = fs.readFileSync('src/components/PlayerSongShareAction.tsx', 'utf8');
const scope = { exports: {}, require(name) {
  if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
  if (name === '@/lib/share-card') return { openBvsShareCard: details => requests.push(details) };
  return {};
} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, scope);
const render = scope.exports.default;
const track = { id: 'b91d86ea-2d7c-4e29-9c71-9dd53d28a111', title: 'Been Bad', artist: 'Wolf Bridges', artwork: '/cover.jpg', src: '/audio.mp3' };
for (const menu of [false, true]) {
  let dismissed = false;
  const button = render({ track, menu, onSelect: () => { dismissed = true; } });
  button.props.onClick();
  assert.ok(dismissed, 'Close the menu before opening the share composer');
  assert.equal(requests.at(-1).path, `/song/${track.id}`, 'Both entry points must share the exact song');
  assert.equal(requests.at(-1).text, track.artist);
  assert.equal(requests.at(-1).image, track.artwork);
}
render({ track: { ...track, kind: 'beat' } }).props.onClick();
assert.equal(requests.at(-1).path, `/beat/${track.id}`, 'Beats must keep their BeatStore destination');
assert.equal(render({ track: { ...track, id: 'rotation-local' } }), null, 'Local rotation entries must not create broken public links');
assert.equal(render({}), null);
console.log('Player Share: exact song link from utility/menu, beat destination, metadata and missing/public ID handling passed.');
