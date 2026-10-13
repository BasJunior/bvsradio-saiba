import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const jsx = (type, props) => ({ type, props });
function load(path, imports = {}, globals = {}) {
 const exports = {}; const code = ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(code,{exports,require:name=>{if(name in imports)return imports[name];throw Error(name);},URL,URLSearchParams,Map,Set,...globals});return exports;
}
const id='fd99fd69-cf38-4a5c-9083-06429d3377ce', second='60472527-3865-4418-bbdc-c26f26fa4ba2';
let reads=[];
const route=load('src/app/api/library/beat-previews/route.ts',{
 'next/server':{NextResponse:{json:(body,opts={})=>({body,status:opts.status||200})}},
 '@/lib/beatstore-server':{beatUrl:path=>'https://db.test/'+path,beatHeaders:{Authorization:'private-server'},publicStorageUrl:path=>path?'/api/media/'+path:null},
 '@/lib/public-name':{creatorPublicName:input=>input.publicName||input.username||''},
},{fetch:async(url,opts)=>{reads.push({url,opts});return{ok:true,json:async()=>url.includes('beats?')?[{id,title:'ALL MEANS',producer_user_id:'producer',preview_path:'tagged-preview.mp3',master_path:'master-secret.wav'}]:[{id:'producer',username:'wolf',creator_public_name:'Wolf Bridges'}]};}});
assert.equal((await route.GET(new Request('https://bvsradio.com/api/library/beat-previews?ids=invalid'))).status,400);assert.equal(reads.length,0);
const result=await route.GET(new Request('https://bvsradio.com/api/library/beat-previews?ids='+id));
assert.equal(result.status,200);assert.equal(result.body.tracks[0].kind,'beat');assert.equal(result.body.tracks[0].src,'/api/media/tagged-preview.mp3');assert.equal(result.body.tracks[0].artist,'Wolf Bridges');assert.equal(result.body.tracks[0].id,'beat-'+id);
assert(reads[0].url.includes('is_public=eq.true&status=eq.published&rights_confirmed=eq.true'));
assert(!JSON.stringify(result.body).includes('master-secret'),'Preview endpoint cannot expose master audio');

const library=load('src/lib/library.ts');
const old={id:'beat-'+id,kind:'track',title:'ALL MEANS',subtitle:'Wolf Bridges',href:'/radio'};
const normalized=library.libraryItemsFromSnapshot(JSON.stringify([old]))[0];assert.equal(normalized.kind,'beat');assert.equal(normalized.href,'/beat/'+id);

// Exercise actual async resolver: publication resolution and removal of stale results.
let slots=[],cursor=0,effects=[],requests=[],resolveFetch;
const hooks={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},useMemo(fn){return fn();},useEffect(fn,deps){const i=cursor++,prior=slots[i];if(!prior||deps.some((dep,j)=>dep!==prior[j])){slots[i]=deps;effects.push(fn);}}};
const resolver=load('src/lib/use-library-playback.ts',{react:hooks},{window:{setTimeout:()=>1,clearTimeout(){}},AbortController,fetch:url=>{requests.push(url);return new Promise(resolve=>{resolveFetch=resolve;});}});
function resolve(items){cursor=0;const value=resolver.useLibraryPlayback(items,[]);effects.splice(0).forEach(fn=>fn());return value;}
assert.equal(resolve([old]).loading,true);assert(requests[0].includes(id));
resolveFetch({ok:true,json:async()=>({tracks:result.body.tracks})});await new Promise(resolve=>setImmediate(resolve));
let playback=resolve([old]);assert.equal(playback.byId.get(id).title,'ALL MEANS');assert.equal(playback.byId.get('beat-'+id).title,'ALL MEANS');
playback=resolve([{...old,id:'beat-'+second}]);assert.equal(playback.byId.has(id),false,'A changed library identity list must hide previous resolution');

// Render the real native Library with the screenshot's legacy beat history.
const calls=[];
const player={tracks:[],playNow:(track,options)=>calls.push({track,options}),playAll:(tracks,options)=>calls.push({tracks,options}),setQueueOpen(){},openNowPlaying(){}};
const react={useState:initial=>[initial,()=>{}],useMemo:fn=>fn(),useEffect(){}};
const imports={react,'react/jsx-runtime':{jsx,jsxs:jsx},'next/image':{default:'img'},'next/link':{default:'link'},
 '@/components/app-vnext/AppBootstrap':{appDestination:()=>'/app/ios/beat/'+id},
 '@/components/app-vnext/AppOfflineDownloads':{default:'downloads'},'@/components/app-vnext/AppPlaylists':{default:'playlists'},
 '@/components/app-vnext/AppSessionProvider':{useAppSession:()=>({signedIn:true,token:'token',user:{id:'member'}})},
 '@/components/StationPlayer':{useStationPlayer:()=>player},'@/lib/app-offline-native':{listOffline:async()=>[]},
 '@/lib/use-local-library':{useLocalLibrary:section=>section==='history'?[old]:[]},
 '@/lib/use-account-json':{useAccountJson:()=>({data:null,loading:false,reload(){}})},
 '@/lib/auth-client-flow':{withAuthTimeout:p=>p,safeAuthDestination:path=>path},
 '@/lib/use-library-playback':{libraryPlaybackId:resolver.libraryPlaybackId,useLibraryPlayback:()=>({byId:new Map([[id,result.body.tracks[0]],['beat-'+id,result.body.tracks[0]]]),loading:false,error:'',retry(){}})},
};
const Component=load('src/components/app-vnext/AppLibraryClient.tsx',imports).default;
function nodes(tree){return tree&&typeof tree==='object'?[tree,...[tree.props?.children].flat(Infinity).flatMap(nodes)]:[];}
const tree=nodes(Component({surface:'ios'}));
const buttons=tree.filter(node=>node.type==='button'&&node.props['aria-label']==='Play ALL MEANS');assert.equal(buttons.length,2,'Artwork and title must both start playback');
for(const button of buttons){assert(!button.props.disabled);button.props.onClick();}
assert.equal(calls.length,2);assert(calls.every(call=>call.track.kind==='beat'&&call.track.src==='/api/media/tagged-preview.mp3'));
assert(tree.some(node=>node.type==='link'&&node.props['aria-label']==='Open ALL MEANS'),'The separate detail arrow stays available');
console.log('Library beat resume passed: public/rights filters, preview-only response, legacy history, stale resolution isolation and actual artwork/title playback taps.');
