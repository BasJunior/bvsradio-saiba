import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function module(path, imports, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(code,{exports,require:name=>{if(name in imports)return imports[name];throw Error(name)},...globals});
  return exports;
}
const paths = [];
const shows = module('src/lib/published-shows.ts',{'server-only':{},'@/lib/media-url':{mediaUrlForStoredValue:value=>value ? `/api/media/${value}` : null}}, {
  process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture'}},AbortSignal,
  fetch:async path=>{paths.push(path);return {ok:true,json:async()=>path.includes('show_creator_profiles')?[{id:'show-1',slug:'weekly',title:'BVS Weekly'}]:[{id:'episode-1',show_id:'show-1',title:'Published drop',audio_path:'episodes/one.mp3',published_at:'2026-10-03T12:00:00Z'},{id:'silent',show_id:'show-1',title:'No audio'}]}}});
const drops = await shows.getPublishedEpisodeDrops();
assert.equal(drops.length,1);
assert.equal(drops[0].showTitle,'BVS Weekly');
assert.equal(drops[0].publishedAt,'2026-10-03T12:00:00Z');
assert(paths.some(path=>path.includes('status=eq.approved')));
assert(paths.some(path=>path.includes('status=eq.published&show_id=in.')));
let played, toggled=0;
const player={current:null,isPlaying:false,playNow:(track,options)=>{played={track,options}},toggle:()=>toggled++};
const jsx=(type,props)=>({type,props});
const list=module('src/components/shows/ShowEpisodeList.tsx',{'@/components/StationPlayer':{useStationPlayer:()=>player},'react/jsx-runtime':{jsx,jsxs:jsx}});
function nodes(tree){return tree && typeof tree==='object'?[tree,...[tree.props?.children].flat(Infinity).flatMap(nodes)]:[]}
let tree=list.default({episodes:drops});
assert(!nodes(tree).some(node=>node.type==='audio'),'Episodes must use the persistent player');
nodes(tree).find(node=>node.type==='button').props.onClick();
assert.equal(played.track.id,'episode-episode-1');
assert.equal(played.track.src,drops[0].audioUrl);
assert.equal(played.options.from,'BVS Weekly');
player.current=played.track;player.isPlaying=true;
nodes(list.default({episodes:drops})).find(node=>node.type==='button').props.onClick();
assert.equal(toggled,1,'Playing the current episode must pause it');
const feed=fs.readFileSync('src/lib/bvs-feed.ts','utf8');
assert(feed.includes('getPublishedEpisodeDrops()'));
assert(feed.includes('id: `episode:${episode.id}`'));
assert(feed.includes('label: "Play episode", intent: "play"'));
console.log('Published show drop visibility and persistent episode playback passed.');
