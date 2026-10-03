import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const jsx = (type, props) => ({type, props});
const calls = [];
let reduced = false;
const rail = {scrollLeft:0,clientWidth:400,scrollWidth:1500,addEventListener(){},removeEventListener(){},scrollBy:options=>calls.push(options)};
const exports = {};
const imports = {
  react:{useId:()=> 'portraits',useRef:()=>({current:rail}),useState:()=>[{previous:false,next:true},()=>{}],useEffect:fn=>fn()},
  'react/jsx-runtime':{jsx,jsxs:jsx}, 'next/image':{default:'image'},'next/link':{default:'link'},
};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/home/CreatorPortraitRail.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{
  exports,require:name=>imports[name],window:{matchMedia:()=>({matches:reduced})},
});
const items=[{id:'one',name:'A creator',image:'/portrait.jpg',href:'/artist/one',detail:'3 tracks'}];
const tree=exports.default({title:'Artists',tone:'paper',allHref:'/music/artists',items});
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
assert.equal(exports.default({title:'Artists',tone:'paper',allHref:'/',items:[]}),null);
const css=fs.readFileSync('src/app/creator-bands.css','utf8');
assert.match(css,/\.bvs-creator-band--paper[^}]*background: #cacaca/);
assert.match(css,/\.bvs-creator-band--ink[^}]*background: #0a0a0a/);
assert.match(css,/\.bvs-creator-photo[^}]*border-radius: 0/);
assert.match(css,/\.bvs-creator-caption[^}]*border-top: 1px/);
assert.match(css,/scroll-snap-type: x proximity/);
const app=fs.readFileSync('src/components/app-vnext/AppHomeDiscoverySections.tsx','utf8');
assert.ok(app.includes('title="Artists" tone="paper"')&&app.includes('title="Producers" tone="ink"'));
assert.ok(app.includes('/explore?kind=artists')&&app.includes('/explore?kind=producers'));
assert.ok(app.includes('getPublishedProducers')&&app.includes('fairDailyOrder(producerRows, "producers")'));
const home=fs.readFileSync('src/components/home/HomeCreatorBands.tsx','utf8');
assert.ok(home.includes('Promise.allSettled')&&home.includes('AbortController'));
console.log('Creator portrait rails: paper/ink bands, divider lines, profile links, scrolling, reduced motion and web/iOS parity passed.');
