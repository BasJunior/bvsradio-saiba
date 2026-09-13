import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const webApi = read("src/app/api/playlists/[id]/tracks/route.ts");
const appApi = read("src/app/api/app/playlists/[id]/tracks/route.ts");
const publicApi = read("src/app/api/playlists/public/route.ts");
const webPicker = read("src/components/library/PlaylistQuickAdd.tsx");
const appPicker = read("src/components/app-vnext/AppPlaylistPicker.tsx");
const libraryAction = read("src/components/LibraryAction.tsx");
const appBeatPreview = read("src/components/app-vnext/AppBeatPreviewPlayer.tsx");
const webDetail = read("src/components/library/PlaylistDetailView.tsx");
const appDetail = read("src/components/app-vnext/AppPlaylistDetailClient.tsx");
const itemHelper = read("src/lib/playlist-item.ts");

for (const [label, source] of [["web", webApi], ["app", appApi]]) {
  assert(source.includes("beat_id"), `${label} playlist API must read and write beat memberships`);
  assert(source.includes("beatId"), `${label} playlist API must accept beatId`);
  assert(source.includes('playlistItemKey("beat"'), `${label} playlist API must expose stable mixed item keys`);
  assert(source.includes("itemKeys"), `${label} playlist API must reorder mixed tracks and beats`);
  assert(source.includes("publicBeatExists"), `${label} playlist API must reject unpublished beats`);
}

assert(itemHelper.includes('return `${kind}:${id}`'), "playlist mixed item keys must preserve kind and id");
assert(webPicker.includes("beatId?: string"), "web playlist picker must accept beats");
assert(webPicker.includes("canonicalBeatId ? { beatId: canonicalBeatId }"), "web playlist picker must post beatId");
assert(appPicker.includes("beatId?: string"), "app playlist picker must accept beats");
assert(appPicker.includes("canonicalBeatId ? { beatId: canonicalBeatId }"), "app playlist picker must post beatId");
assert(libraryAction.includes("item.kind !== 'track' && item.kind !== 'beat'"), "LibraryAction must expose playlists for beats as well as tracks");
assert(libraryAction.includes("beatId={item.kind === 'beat' ? item.id : undefined}"), "web beat save action must pass the beat to playlist picker");
assert(appBeatPreview.includes("<AppPlaylistPicker beatId={beatId} compact />"), "app BeatStore previews must expose Add to playlist");
assert(webDetail.includes("itemKeys: next.map(rowKey)"), "web playlist detail must reorder mixed items");
assert(webDetail.includes("beatId ? { beatId } : { trackId }"), "web playlist detail must remove beats safely");
assert(appDetail.includes("itemKeys: next"), "app playlist detail must reorder mixed items");
assert(appDetail.includes("beatId ? { beatId } : { trackId }"), "app playlist detail must remove beats safely");
assert(publicApi.includes("select=playlist_id,track_id,beat_id"), "public playlist discovery must load beat memberships");
assert(publicApi.includes("itemCount: publicMemberships.length"), "public playlist discovery must count mixed items");
assert(publicApi.includes("publicStorageUrl(beatById.get(item.beat_id)?.artwork_path)"), "public playlist discovery must use beat artwork for playlist covers");

console.log("Mixed track + BeatStore playlist assertions passed.");
