import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const code = ts.transpileModule(readFileSync('src/lib/public-releases.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

async function load({ trackLookupFails = false } = {}) {
  const exports = {};
  const response = (rows, status = 200) => new Response(JSON.stringify(rows), { status });
  vm.runInNewContext(code, {
    exports,
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://fixture.invalid', SUPABASE_SERVICE_ROLE_KEY: 'fixture' } },
    require(name) {
      if (name === 'server-only') return {};
      if (name.endsWith('media-url')) return { mediaUrlForStoredValue: path => `/api/media/${path}` };
      throw new Error(name);
    },
    async fetch(rawUrl) {
      const path = new URL(rawUrl).pathname.split('/').at(-1);
      if (path === 'releases') return response([{ id: 'release', title: 'Release', artist_name: 'Artist' }]);
      if (path === 'release_tracks') return response([
        { id: 'member-public', release_id: 'release', track_id: 'track-public', title: 'Public', position: 1, audio_path: 'public.mp3' },
        { id: 'member-private', release_id: 'release', track_id: 'track-private', title: 'Private', position: 2, audio_path: 'private.mp3' },
        { id: 'member-orphan', release_id: 'release', title: 'Orphan', position: 3, audio_path: 'orphan.mp3' },
      ]);
      if (path === 'tracks') {
        assert.equal(new URL(rawUrl).searchParams.get('is_public'), 'eq.true');
        assert.equal(new URL(rawUrl).searchParams.get('editorial_status'), 'eq.approved');
        return response(trackLookupFails ? { error: 'unavailable' } : [{ id: 'track-public' }], trackLookupFails ? 503 : 200);
      }
      if (path === 'track_credits') return response([]);
      throw new Error(rawUrl);
    },
  });
  return exports.getPublicReleases();
}

assert.deepEqual(Array.from((await load())[0].tracks, track => track.title), ['Public']);
assert.equal((await load({ trackLookupFails: true })).length, 0);
console.log('Public releases exclude private and orphan tracks; failed access lookup closes the listing.');
