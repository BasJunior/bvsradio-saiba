import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const jsx = (type, props) => ({type, props});
const calls = [];
let reduced = false;
const rail = {scrollLeft:0,clientWidth:400,scrollWidth:1500,addEventListener(){},removeEventListener(){},scrollBy:options=>calls.push(options)};
const exports = {};
const searchExports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/discovery-search.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:searchExports});
for (const query of ['Hills', 'W.Hills', 'W. Hills', 'W. Hill$', 'w.hills']) assert.equal(searchExports.matchesDiscoveryQuery(query,['W. Hill$', '/artist/w.hills']),true,`Find Hills with ${query}`);
assert.equal(searchExports.matchesDiscoveryQuery('Wolf',['W. Hill$', '/artist/w.hills']),false);
const imports = {
  '@/lib/discovery-search':searchExports,
  react:{useId:()=> 'portraits',useRef:()=>({current:rail}),useState:value=>[typeof value === "string" ? value : {previous:false,next:true},()=>{}],useEffect:fn=>fn()},
  'react/jsx-runtime':{jsx,jsxs:jsx}, 'next/image':{default:'image'},'next/link':{default:'link'},
  '@/lib/image-optimization':{shouldBypassImageOptimizer: source => /^https?:|blob:|data:/.test(source)},
};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/home/CreatorPortraitRail.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{
  exports,require:name=>imports[name],window:{matchMedia:()=>({matches:reduced})},
});
const items=[{id:'one',name:'A creator',image:'/portrait.jpg',href:'/artist/one',detail:'3 tracks'}];
const tree=exports.default({title:'Artists',tone:'ink',allHref:'/music/artists',items});
function nodes(tree){return tree&&typeof tree==='object'?[tree,...[tree.props?.children].flat(Infinity).flatMap(nodes)]:[];}
const all=nodes(tree);
assert.equal(all.find(node=>node.props?.className==='bvs-creator-portrait').props.href,'/artist/one');
assert.ok(all.find(node=>node.props?.className==='bvs-creator-caption'),'Name caption needs a separate divider surface');
assert.ok(all.find(node=>node.props?.role==='region'&&node.props.tabIndex===0),'Rail supports keyboard scrolling');
const previous=all.find(node=>node.props?.['aria-label']==='Scroll artists left');
const next=all.find(node=>node.props?.['aria-label']==='Scroll artists right');
assert.equal(previous.props.disabled,true);
assert.equal(next.props.disabled,false);
next.props.onClick();
assert.equal(calls[0].left,320);assert.equal(calls[0].behavior,'smooth');
reduced=true;previous.props.onClick();
assert.equal(calls[1].left,-320);assert.equal(calls[1].behavior,'auto');
assert.equal(exports.default({title:'Artists',tone:'ink',allHref:'/',items:[]}),null);
const css=fs.readFileSync('src/app/creator-bands.css','utf8');
assert.ok(!css.includes('#cacaca')&&!css.includes('band--paper'),'No alternating grey surfaces');
assert.match(css,/\.bvs-creator-band--ink[^}]*background: #0a0a0a/);
assert.match(css,/\.bvs-creator-photo[^}]*border-radius: 0/);
assert.match(css,/\.bvs-creator-caption[^}]*border-top: 1px/);
assert.match(css,/scroll-snap-type: x proximity/);
const app=fs.readFileSync('src/components/app-vnext/AppHomeDiscoverySections.tsx','utf8');
assert.ok(app.includes('title="Artists" tone="charcoal"')&&app.includes('title="Producers" tone="ink"'));
assert.match(css,/\.bvs-creator-band--charcoal[^}]*background: #1b1b1b/,'Artist grey must stay close to black');
assert.ok(app.includes('/explore?kind=artists')&&app.includes('/explore?kind=producers'));
assert.ok(app.includes('getPublishedProducers')&&app.includes('fairDailyOrder(producerRows, "producers")'));
const home=fs.readFileSync('src/components/home/HomeCreatorBands.tsx','utf8');
assert.ok(home.includes('Promise.allSettled')&&home.includes('AbortController'));
for (const path of ['src/app/page.tsx','src/app/app/[surface]/page.tsx']) assert.ok(fs.readFileSync(path,'utf8').includes('bvs-square-home'));
assert.match(css,/\.bvs-square-home \[class\*="rounded"\][^}]*border-radius: 0/);
assert.match(css,/\.bvs-square-home section[^}]*border-inline: 0/);
console.log('Dark square Home: divider lines, no grey bands, profile links, scrolling, reduced motion and web/iOS parity passed.');
const directoryHeading = nodes(exports.default({title:'Artists',tone:'charcoal',allHref:'/catalogue',items,headingLevel:1}));
assert.equal(directoryHeading.filter(node=>node.type==='h1').length,1,'Full directory has one real page heading');
assert.ok(all.some(node=>node.type==='h2'),'Home retains its section heading');
const directoryExports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/home/DiscoveryDirectory.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{
  exports:directoryExports,require:name=>name==='./CreatorPortraitRail'?{default:'shared-rail'}:imports[name],
});
const grid=nodes(exports.default({title:'Artists',tone:'charcoal',allHref:'/catalogue',items,layout:'grid'}));
assert.ok(grid.some(node=>node.props?.className?.includes('bvs-creator-portrait-grid')));
assert.equal(grid.filter(node=>node.type==='button').length,0,'Full directory displays a grid without sideways-only controls');
const directoryItems=Array.from({length:30},(_,index)=>({...items[0],id:String(index),secondaryHref:'/catalogue?producer=one',secondaryLabel:'View catalogue'}));
const directory=nodes(directoryExports.default({title:'Producers',kicker:'BeatStore',description:'Published producers',items:directoryItems,browseHref:'/catalogue',browseLabel:'Browse beats',emptyMessage:'No producers yet'}));
assert.equal(directory.find(node=>node.type==='shared-rail').props.items.length,30,'See all must preserve the full collection');
assert.equal(directory.filter(node=>node.type==='article').length,30);
assert.equal(directory.filter(node=>node.type==='link'&&node.props.href==='/catalogue?producer=one').length,30,'Producer catalogue links stay available');
for(const page of ['src/app/music/artists/page.tsx','src/app/music/producers/page.tsx','src/app/shows/page.tsx']) assert.ok(fs.readFileSync(page,'utf8').includes('DiscoveryDirectory'));
console.log('See-all directories passed: shared Home rail, page heading, full collection and catalogue links.');
const catalogue=fs.readFileSync('src/app/catalogue/page.tsx','utf8');
assert.ok(catalogue.includes('data-beat-directory={beatsMode ? true : undefined}'));
assert.ok(catalogue.includes('filteredTracks.map((track) =>'), 'BeatStore preserves all filtered results');
