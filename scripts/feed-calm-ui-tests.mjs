import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const jsx = (type, props) => ({type, props});
const events = [];
const slots = []; let index = 0;
const react = {
  useState(initial) { const i=index++; if (!(i in slots)) slots[i]=initial; return [slots[i], value=>slots[i]=value]; },
  useRef() { index++; return {current:null}; },
};
const exports = {};
const imports = {
  react, 'react/jsx-runtime':{jsx,jsxs:jsx},
  'next/image':{default:'image'}, 'next/link':{default:'link'},
  '@/lib/bvs-object':{objectKindLabel:kind=>kind},
  '@/lib/flow-session':{recordFlowOpen(){}}, '@/lib/analytics':{trackEvent(){}},
  '@/components/flow/BvsActionSheet':{default:'sheet'},
};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/flow/BvsObjectCard.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{
  exports,require:name=>imports[name],
  window:{dispatchEvent:event=>events.push(event)},
  CustomEvent:class { constructor(type,{detail}) {this.type=type;this.detail=detail;} },
});
const object = {id:'beat-1',kind:'beat',title:'A beat',route:'/catalogue?type=beat&q=A',media:{src:'/preview.mp3'},primaryAction:{id:'play',label:'Preview',intent:'play'},overflowActions:[{id:'next',label:'Play next',intent:'play-next'},{id:'licence',label:'Licences',intent:'navigate',href:'/catalogue?type=beat&q=A'}]};
function render(){index=0;const element=exports.default({object,variant:'feed-beat',menuExtras:'save-follow-control'});return element.type(element.props);}
function nodes(tree){return tree && typeof tree==='object'?[tree,...[tree.props?.children].flat(Infinity).flatMap(nodes)]:[];}
let tree=render();
const play=nodes(tree).find(node=>node.props?.['aria-label']==='Preview A beat');
assert.ok(play,'Artwork must expose a named primary play target');
play.props.onClick();
assert.equal(events[0].detail.action,'play');
assert.equal(events[0].detail.track.src,'/preview.mp3');
assert.equal(events[0].detail.track.kind,'beat');
assert.ok(!nodes(tree).some(node=>node.type==='button'&&node.props.children==='Preview'),'No duplicate standalone Play pill');
nodes(tree).find(node=>node.props?.['aria-label']==='More actions for A beat').props.onClick();
tree=render();
const sheet=nodes(tree).find(node=>node.type==='sheet');
assert.equal(sheet.props.open,true,'More must open the action sheet');
assert.equal(sheet.props.extras,'save-follow-control','Save/follow must reach the same menu');
assert.equal(sheet.props.object.overflowActions[1].href,'/beat/beat-1','Exact beat licence destination must be preserved');
assert.equal(sheet.props.object.overflowActions[0].intent,'play-next');
const feed=fs.readFileSync('src/components/feed/BvsFeedList.tsx','utf8');
assert.match(feed,/<details[^>]*data-feed-refine="true"/,'Search/filter must use accessible progressive disclosure');
assert.match(feed,/menuExtras=\{item.social \? <LibraryAction/);
const posts=fs.readFileSync('src/components/feed/ParticipationPostCard.tsx','utf8');
assert.ok(posts.indexOf('FeedMoreActions title')<posts.indexOf('toggle("repost")'),'Repost must remain in the post menu');
assert.ok(posts.includes('removePost()')&&posts.includes('setEditing'),'Owner actions must remain available');
console.log('Calm Feed: artwork playback, no duplicate Play, action menu, save/follow, queue/licence routes and retained post controls passed.');
