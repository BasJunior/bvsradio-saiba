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
let fail = false, refreshes = 0;
const post = { threadId:'p1', body:'Looking for a vocalist', createdAt:new Date().toISOString(), author:{id:'u1',displayName:'River',username:'river'}, likeCount:2,repostCount:0,replyCount:1,viewerLiked:false,viewerReposted:false,intent:'collaboration',attachment:null };
const session = { token:'test-only', signedIn:true, user:{id:'u1'} };
const imports = {
  'next/link':{default:'link'}, 'next/navigation':{useRouter:()=>({refresh:()=>refreshes++})},
  '@/components/app-vnext/AppSessionProvider':{useAppSession:()=>session},
  '@/lib/share-card':{openBvsShareCard:()=>{}}, '@/lib/share-url':{canonicalBvsShareUrl:s=>s}, '@/lib/library':{readLibrary:()=>[]},
};
for (const [path, type] of Object.entries({
  '@/components/flow/BvsObjectCard':'object', '@/components/LibraryAction':'library', '@/components/feed/FeedComposer':'composer',
  '@/components/feed/FeedParticipation':'participation', '@/components/feed/ParticipationPostCard':'post',
})) imports[path] = {default:type};
const render = harness('src/components/feed/BvsFeedList.tsx', imports, {
  CustomEvent:class {}, window:{addEventListener(){},removeEventListener(){},dispatchEvent(){},setTimeout:fn=>fn(),scrollY:0},
  fetch:async()=>({ok:!fail,json:async()=>fail?{error:'Connection unavailable'}:{posts:[post],nextCursor:'next'}}),
});
const props = {items:[],surface:null,participationEnabled:true};
render(props); await settle();
let tree = render(props);
assert.equal(nodes(tree).filter(n=>n.type==='post').length,1);
fail = true;
button(tree,'Refresh feed').props.onClick(); await settle(); tree = render(props);
assert.equal(refreshes,1,'Refresh must use the router');
assert.equal(nodes(tree).filter(n=>n.type==='post').length,1,'Failed refresh must preserve loaded posts');
assert.ok(button(tree,'Try again'),'Failed refresh must offer recovery');
fail = false;
button(tree,'Try again').props.onClick(); await settle(); tree = render(props);
assert.ok(!button(tree,'Try again'),'Successful retry must clear the error');
nodes(tree).find(n=>n.type==='input').props.onChange({target:{value:'VOCALIST'}});
tree = render(props); assert.equal(nodes(tree).filter(n=>n.type==='post').length,1,'Search must ignore case and search post bodies');
nodes(tree).find(n=>n.type==='input').props.onChange({target:{value:'no-such-post'}});
tree = render(props); assert.equal(nodes(tree).filter(n=>n.type==='post').length,0);
button(tree,'Clear search').props.onClick(); tree = render(props);
assert.equal(nodes(tree).filter(n=>n.type==='post').length,1);
button(tree,'Following').props.onClick(); render(props); await settle();
// Cards must consume newly refreshed parent data, and roll back unsuccessful reactions.
const changes = []; let resolveReaction;
const renderCard = harness('src/components/feed/ParticipationPostCard.tsx', imports, {
  fetch:()=>new Promise(resolve=>{resolveReaction=resolve;}),
});
const cardProps = {post,surface:null,enabled:true,onChanged:next=>changes.push(next)};
renderCard(cardProps);
const fresh = {...post,body:'Updated from the server',likeCount:7};
tree = renderCard({...cardProps,post:fresh});
assert.ok(nodes(tree).some(n=>n.props?.children===fresh.body),'Fresh post body must replace old content');
const like = nodes(tree).find(n=>n.type==='button' && n.props['aria-pressed']===false && n.props.children?.includes(7));
assert.ok(like,'Fresh reaction count must be visible');
like.props.onClick(); tree = renderCard({...cardProps,post:changes.at(-1)});
assert.ok(nodes(tree).filter(n=>n.type==='button' && 'aria-pressed' in n.props).every(n=>n.props.disabled),'Pending reactions must prevent conflicting requests');
resolveReaction({ok:false,json:async()=>({error:'Try again'})}); await settle();
assert.equal(changes.at(-1).likeCount,7,'Failed reaction must restore the count');
assert.equal(changes.at(-1).viewerLiked,false,'Failed reaction must restore viewer state');
console.log('Feed experience tests passed: refresh retention, retry, search, fresh card data and reaction rollback.');
