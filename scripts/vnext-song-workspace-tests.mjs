import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const server = await readFile(new URL("../src/lib/song-workspaces-server.ts", import.meta.url), "utf8");
const collectionRoute = await readFile(new URL("../src/app/api/creator/song-workspaces/route.ts", import.meta.url), "utf8");
const itemRoute = await readFile(new URL("../src/app/api/creator/song-workspaces/[id]/route.ts", import.meta.url), "utf8");
const ownedRoute = await readFile(new URL("../src/app/api/library/owned/route.ts", import.meta.url), "utf8");
const library = await readFile(new URL("../src/components/app-vnext/AppLibraryClient.tsx", import.meta.url), "utf8");
const workspace = await readFile(new URL("../src/components/app-vnext/AppSongWorkspaceClient.tsx", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase-song-workspaces.sql", import.meta.url), "utf8");

assert.match(server, /customer_user_id=eq\.\$\{encodeURIComponent\(userId\)\}/, "entitlement lookup must bind orders to the signed-in buyer");
assert.match(server, /\['paid', 'fulfilled'\]\.includes\(String\(order\.status\)\)/, "licensed-beat orders must require paid or fulfilled status");
assert.match(server, /order\.status === 'free_workspace'[\s\S]*workspaceKind === 'blank'[\s\S]*licenceCode === 'writing_pad_free'[\s\S]*Number\(item\.price \|\| 0\) === 0/, "free pads must require the exact zero-value internal workspace markers");
assert.match(server, /status: 'free_workspace'/, "a free pad must never masquerade as a paid or fulfilled order");
assert.match(server, /rights_confirmed: false[\s\S]*status: 'draft'[\s\S]*is_public: false/, "the blank-pad backing row must remain private and make no rights claim");
assert.match(server, /beatItems\.find\(\(candidate\) => beatIdFromItem\(candidate\) === requestedBeatId\)/, "the requested beat must exist in the buyer order");
assert.match(server, /beat\.preview_path/, "workspace playback must use the beat preview");
assert.doesNotMatch(server, /signedAudio\(beat\.master_path/, "workspace playback must not expose private masters");

assert.match(collectionRoute, /findBeatEntitlement\(user\.id, orderReference, beatId\)/, "workspace creation must re-check entitlement server-side");
assert.match(collectionRoute, /if \(!orderReference && !beatId\)[\s\S]*createFreeSongWorkspace\(user\)/, "every signed-in member must be able to create a blank Lyrics Pad");
assert.match(collectionRoute, /status: 403/, "failed entitlement checks must return 403");
assert.match(itemRoute, /getOwnSongWorkspace\(user\.id, id\)/, "workspace access must remain owner-scoped");
assert.match(itemRoute, /findBeatEntitlement\(user\.id, row\.order_reference, row\.beat_id\)/, "workspace access must re-check active entitlement");
assert.match(ownedRoute, /customer_user_id=eq\.\$\{encodeURIComponent\(user\.id\)\}/, "licensed beats must be loaded only for the signed-in user");

assert.match(library, /\+ New Lyrics Pad/, "vNext Library must expose free Lyrics Pad creation");
assert.match(library, /A beat purchase is not required/, "the free Lyrics Pad must not imply a purchase requirement");
assert.match(library, /No purchasing takes place in this app/, "the iOS surface must explain its non-commerce boundary");
assert.doesNotMatch(library, /href=.*(?:checkout|catalogue)/i, "the licensed-beat workspace must not link to checkout or web catalogue");
assert.doesNotMatch(library, /\$\{?beat\.(?:price|priceUsd)/, "the iOS licensed-beat workspace must not display a purchase price");
assert.match(workspace, /Lyrics and notes autosave privately/, "the workspace must explain private autosave");
assert.match(workspace, /router\.back\(\)/, "the workspace must preserve hierarchical native back navigation");

assert.match(migration, /alter table public\.song_workspaces enable row level security/i, "Song Workspace must retain RLS");
assert.match(migration, /create policy "song workspaces select own"[\s\S]*auth\.uid\(\) = user_id/i, "browser reads must remain owner-only");
assert.doesNotMatch(migration, /create policy[\s\S]{0,120}for insert/i, "browser inserts must remain disabled");
assert.doesNotMatch(migration, /create policy[\s\S]{0,120}for update/i, "browser updates must remain server-mediated");
assert.match(migration, /revoke execute on function public\.verify_bvs_song_workspace_clearance\(\) from public, anon, authenticated/i, "the SECURITY DEFINER trigger must not be browser-callable");
assert.match(migration, /o\.status in \('paid', 'fulfilled'\)/i, "free pads must never auto-approve leased-beat release clearance");

console.log("vNext free and licensed Lyrics Pad checks passed");
