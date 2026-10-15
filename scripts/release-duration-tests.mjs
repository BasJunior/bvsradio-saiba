import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const code = ts.transpileModule(readFileSync('src/lib/releases-server.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
async function publish({ existing = false, source = 'audio/song.mp3', duration = 130.4555, unavailable = false } = {}) {
  const writes = [];
  const exports = {};
  const response = (value, status = 200) => new Response(JSON.stringify(value), { status });
  vm.runInNewContext(code, {
    exports, console, process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://fixture.invalid', SUPABASE_SERVICE_ROLE_KEY: 'fixture' } },
    require(name) {
      if (name === 'server-only') return {};
      if (name.endsWith('storage-upload')) return { serviceHeaders: () => ({}) };
      if (name.endsWith('media-url')) return { mediaUrlForStoredValue: key => key.startsWith('/') ? key : `/api/media/${key}` };
      if (name.endsWith('distribution-path')) return { distributionJobNotes: () => 'fixture' };
      throw new Error(name);
    },
    async fetch(url, init = {}) {
      const path = new URL(url).pathname.split('/').at(-1);
      if (init.method === 'PATCH' || init.method === 'POST') {
        writes.push({ path, body: JSON.parse(init.body) });
        return response(path === 'tracks' ? [{ id: 'catalogue-id' }] : {});
      }
      if (path === 'releases') return response([{ id: 'release', user_id: 'owner', artist_name: 'Artist', title: 'Release' }]);
      if (path === 'release_tracks') return response([{ id: 'member', title: 'Song', audio_path: 'audio/song.mp3', track_id: existing ? 'catalogue-id' : null }]);
      if (path === 'media_processing_jobs') return unavailable ? response({}, 503) : response([{ release_track_id: 'member', source_path: source, duration_seconds: duration }]);
      return response([]);
    },
  });
  return { result: await exports.materializeReleaseTracks('release', { publish: true, inRotation: true, reviewedBy: 'editor' }), writes };
}
for (const existing of [false, true]) {
  const { result, writes } = await publish({ existing });
  assert.equal(result.ok, true);
  const track = writes.find(write => write.path === 'tracks').body;
  assert.equal(track.duration_sec, 130.4555, 'both insert and update must retain measured precision');
  assert.equal(track.in_rotation, true);
}
for (const options of [{ source: 'audio/old-version.mp3' }, { duration: 0 }, { duration: null }, { unavailable: true }]) {
  const { result, writes } = await publish(options);
  assert.equal(result.ok, false, 'missing or stale probes must block publication');
  assert.equal(writes.some(write => write.path === 'tracks'), false);
}
console.log('Release duration publication tests passed.');
