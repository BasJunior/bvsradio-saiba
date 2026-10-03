import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const jsx = (type, props) => ({ type, props });
const settle = () => new Promise(resolve => setImmediate(resolve));
function harness(path, imports, globals = {}) {
  const slots = [], effects = []; let index = 0;
  const memo = (fn, deps) => {
    const i = index++, old = slots[i];
    if (!old || deps.some((d, n) => d !== old.deps[n])) slots[i] = { deps, value: fn() };
    return slots[i].value;
  };
  const react = {
    useState(initial) { const i = index++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = index++; return slots[i] ||= { current: initial }; },
    useMemo: memo, useCallback: (fn, deps) => memo(() => fn, deps),
    useEffect(fn, deps) { memo(() => { effects.push(fn); }, deps); },
  };
  const exports = {};
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, queueMicrotask, URLSearchParams, console, require(name) {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' };
    if (name in imports) return imports[name];
    throw Error(`Unexpected import: ${name}`);
  }, ...globals });
  return props => { index = 0; const tree = exports.default(props); effects.splice(0).forEach(fn => fn()); return tree; };
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];
}
function button(tree, label) { return nodes(tree).find(n => n.type === 'button' && (n.props.children === label || n.props['aria-label'] === label)); }
function pure(path, imports = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS} }).outputText;
  vm.runInNewContext(code,{exports,require:name=>imports[name] || (()=>{throw Error(name)})(),Intl,Date,Map,Set});
  return exports;
}
const fair = pure('src/lib/fair-discovery-order.ts');
const discovery = pure('src/lib/discovery-experience.ts',{'@/lib/fair-discovery-order':fair});
const now = new Date('2026-10-03T09:00:00Z');
const music = Array.from({length:18},(_,i)=>({id:`track-${i}`,kind:'track',title:`Song ${i}`,subtitle:`Artist ${i % 9}`,href:`/catalogue?q=Song${i}`,tags:[i%2?'Hip Hop':'Gospel'],publishedAt:`2026-09-${String(10+i).padStart(2,'0')}T00:00:00Z`,detail:{id:`${i}`,kind:'track',title:`Song ${i}`,artist:`Artist ${i%9}`,genre:i%2?'Hip Hop':'Gospel',src:`/api/media/track${i}.mp3`,href:'/catalogue'}}));
assert.equal(discovery.discoveryCreatorKey('REVO, ft. Nigel, Chesa'),'revo');
assert.equal(discovery.discoveryCreatorKey('REVO ft. Lavish'),'revo');
assert.equal(discovery.discoveryCreatorKey('REVO'),'revo');
const collaborations = music.map((item, i) => ({...item,detail:{...item.detail,artist:i < 8 ? `Lead, ft. Guest ${i}` : `Other ${i}`}}));
const collaborationPicks = discovery.buildDiscoveryShelves(collaborations,0,'',now)[0].items;
assert.equal(new Set(collaborationPicks.map(item => discovery.discoveryCreatorKey(item.detail.artist))).size,6,'Collaboration credits must not give one lead artist extra discovery slots');
const silent = {...music[0],id:'silent',detail:{...music[0].detail,src:undefined},publishedAt:undefined};
const pool = [...music,silent,{id:'creator-1',kind:'artist',title:'Artist',subtitle:'Artist',href:'/artist/published',tags:['Hip-Hop']}];
const shelves = discovery.buildDiscoveryShelves(pool,0,'',now);
const picks = shelves.find(s=>s.id==='listen').items;
assert.equal(picks.length,6);
assert.equal(new Set(picks.map(i=>i.detail.artist)).size,6,'First discovery screen must give different artists a turn');
assert.ok(!picks.some(i=>i.id==='silent'),'Unplayable items must not enter the discovery queue');
assert.notEqual(discovery.buildDiscoveryShelves(pool,1,'',now)[0].items.map(i=>i.id).join(),picks.map(i=>i.id).join(),'Next selection must change the picks');
assert.equal(discovery.buildDiscoveryShelves(pool,0,'',now)[0].items.map(i=>i.id).join(),picks.map(i=>i.id).join(),'Picks must remain stable within the BVS day');
const hipHop = discovery.buildDiscoveryShelves(pool,0,'hip-hop',now)[0].items;
assert.ok(hipHop.every(i=>discovery.matchesSound(i,'Hip-Hop')));
assert.equal(discovery.discoverySounds(pool).filter(i=>i.key==='hip-hop').length,1,'Genre spelling variants must not duplicate chips');
assert.ok(!discovery.discoverySounds(pool).some(i=>i.key.startsWith('artist')),'Artist names must not become genre chips');
assert.equal(shelves.find(s=>s.id==='fresh').items[0].id,'track-17','Fresh arrivals must sort newest first');
assert.equal(discovery.toDiscoveryTrack(silent),null);
const sellable = {...music[0],detail:{...music[0].detail,price:2,streamOnly:false}};
assert.equal(discovery.toDiscoveryTrack(sellable).isDownloadable,true,'Discover playback must carry the public download offer into the player');
assert.equal(discovery.toDiscoveryTrack(sellable).downloadPrice,2);
assert.equal(discovery.toDiscoveryTrack({...sellable,detail:{...sellable.detail,streamOnly:true}}).isDownloadable,false);
assert.equal(discovery.toDiscoveryTrack({...sellable,kind:'beat'}).isDownloadable,false,'Beat preview must not become a song download');
const boundary = pure('src/lib/app-external-boundary.ts');
assert.equal(boundary.isExternalLegalOrLicenceUrl(new URL('https://bvsradio.com/buy?track=track-1')),true,'Native query-style Buy links must open web checkout externally');
assert.equal(boundary.isExternalLegalOrLicenceUrl(new URL('https://bvsradio.com/app/ios/explore')),false);
const renderBuy = harness('src/components/BuyTrackButton.tsx',{
  '@/lib/analytics':{trackEvent(){}}, '@/lib/cart-client':{upsertTrackCartLine(){}},
});
const buyTree = renderBuy({track:{id:'track-1',title:'Song',artist:'Artist',src:'/media.mp3',isDownloadable:true,downloadPrice:2},variant:'compact'});
assert.equal(buyTree.props.href,'https://bvsradio.com/buy?track=track-1');
assert.ok(nodes(buyTree).some(n=>n.type==='span' && n.props.children==='Buy' && n.props.className==='sm:hidden'),'Compact player must have a visible mobile Buy label');
assert.equal(renderBuy({track:{id:'off-sale',isDownloadable:false,downloadPrice:2},variant:'compact'}),null);
const playerSource=readFileSync('src/components/StationPlayer.tsx','utf8');
assert.match(playerSource, /variant="compact" className="inline-flex min-h-10/,'Compact Buy must not be hidden on mobile');
assert.equal(discovery.buildDiscoveryShelves(pool,0,'missing',now).length,0,'An empty genre must not show unrelated picks');

let finishBeats, opened = 0, played = [], saved = [];
const nativeTracks = music.map(i=>({id:i.detail.id,title:i.title,artist:i.detail.artist,src:i.detail.src,genre:i.detail.genre}));
const player = {current:null,isPlaying:false,playNow:(item,opts)=>played.push({item,opts}),playAll:items=>played.push({items}),setQueueOpen(){},openNowPlaying(){opened++;},toggle(){}};
const imports = {
  'next/link':{default:'link'},'next/image':{default:'image'},
  '@/components/app-vnext/AppBeatPreviewPlayer':{default:'preview'},
  '@/components/app-vnext/AppDownloadButton':{default:'download'},
  '@/components/app-vnext/AppPlaylistPicker':{default:'playlist'},
  '@/components/StationPlayer':{useStationPlayer:()=>player},
  '@/lib/fair-discovery-order':fair,'@/lib/discovery-experience':discovery,
  '@/lib/analytics':{trackEvent(){}},
  '@/lib/library':{hasLibraryItem:()=>false,recordListening:item=>saved.push(item),toggleLibraryItem:()=>true},
};
const fetches = [];
const render = harness('src/components/app-vnext/AppExploreClient.tsx',imports,{
  AbortController,
  window:{location:{search:''},history:{state:{},replaceState(){}},setTimeout:()=>0,clearTimeout(){},addEventListener(){},removeEventListener(){}},
  fetch:async url=>{
    fetches.push(url);
    if(url==='/api/beats') return await new Promise(resolve=>{finishBeats=resolve;});
    return {ok:true,json:async()=>url.startsWith('/api/station')?{tracks:nativeTracks}:url==='/api/artists'?{artists:[{id:'c1',username:'one',name:'One',genres:['Hip-Hop']}]}:{producers:[]}};
  },
});
const props={surface:'ios'};
render(props); await settle(); let tree=render(props);
assert.ok(fetches.includes('/api/station/tracks?surface=ios'),'Native music must retain surface rights filtering');
assert.equal(nodes(tree).filter(n=>n.type==='article').length,6,'Music must appear before a slow beat request finishes');
finishBeats({ok:false}); await settle(); tree=render(props);
assert.ok(button(tree,'Retry loading'),'Partial failures must offer recovery');
assert.equal(nodes(tree).filter(n=>n.type==='article').length,6,'One failed source must not wipe music');
button(tree,'Hip-Hop').props.onClick(); tree=render(props);
button(tree,'▶ Play discoveries').props.onClick();
assert.ok(played.at(-1).items.every(i=>discovery.soundKey(i.genre)==='hip-hop'),'Native discovery queue must respect the selected genre');
button(tree,'Play').props.onClick();
assert.equal(opened,0,'Starting a discovery track must keep the browsing screen open');
assert.equal(saved.at(-1).href,'/app/ios','Native listening history must stay in the app namespace');
button(tree,'Show more music →').props.onClick(); tree=render(props);
assert.equal(nodes(tree).filter(n=>n.type==='article').length,9,'Browse more must expose the full matched pool');
const search=nodes(tree).find(n=>n.type==='input');search.props.onChange({target:{value:'no-match'}});tree=render(props);
assert.ok(button(tree,'Start discovering'),'Empty native views must offer a reset');
console.log('Discover behavior passed: diverse rotating picks, genre matching, real playback, fresh order, independent native loading, rights-scoped queue, browse-more and empty-state recovery.');
