import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const threadId = '11111111-1111-4111-8111-111111111111';
const messageId = '22222222-2222-4222-8222-222222222222';
const actorId = '33333333-3333-4333-8333-333333333333';
const compile = path => ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
function route({ signedIn = true, confirmed = true, blocked = false, visible = true, message = true, allowed = true, available = true } = {}) {
  const writes = [];
  const exports = {};
  vm.runInNewContext(compile('src/app/api/app/participation/threads/[id]/messages/[messageId]/like/route.ts'), {
    exports, Response, Date,
    require(name) {
      if (name === 'next/server') return { NextResponse: { json: (data, init) => Response.json(data, init) } };
      if (name.includes('app-api-auth')) return { requireAppUser: async () => signedIn ? { id: actorId, emailConfirmedAt: confirmed ? '2026-01-01' : null } : null };
      if (name.includes('participation-route')) return { withParticipationErrors: run => run() };
      if (name.includes('participation-server')) return {
        participationEnabled: () => true, participationReady: () => true,
        participationRequestSurface: request => { assert.equal(new URL(request.url).searchParams.get('surface'), 'ios'); return 'ios'; },
        participationVisibleThread: async (_id, viewer, surface) => { assert.equal(viewer, actorId); assert.equal(surface, 'ios'); return visible ? { id: threadId, status: 'published' } : null; },
        participationRows: async path => { assert(path.includes(`thread_id=eq.${threadId}`)); assert(path.includes('message_kind=in.(comment,reply)')); return message ? [{ id: messageId, author_user_id: 'other' }] : []; },
        blockedPair: async () => blocked,
        checkParticipationRateLimit: async () => ({ allowed, retryAfter: 7 }),
        participationRpc: async (name, body) => { assert.equal(name, 'set_participation_message_like'); writes.push(body); return available ? [{ message_id: messageId, like_count: body.p_active ? 1 : 0, viewer_liked: body.p_active }] : []; },
      };
      throw Error(name);
    },
  });
  return { writes, run: body => exports.PUT(new Request('https://bvsradio.com/api/like?surface=ios', { method: 'PUT', body: JSON.stringify(body) }), { params: Promise.resolve({ id: threadId, messageId }) }) };
}
for (const [options, status] of [[{signedIn:false},401],[{confirmed:false},403],[{visible:false},404],[{message:false},404],[{blocked:true},404],[{allowed:false},429],[{available:false},404]]) {
  const api = route(options); const response = await api.run({active:true}); assert.equal(response.status,status);
  if (!('available' in options)) assert.equal(api.writes.length,0,'Rejected requests must not write likes');
}
const invalid = route(); assert.equal((await invalid.run({active:'yes'})).status,400); assert.equal(invalid.writes.length,0);
const api = route();
for (const active of [true,true,false]) {
  const response = await api.run({active,actorId:'spoofed'}); assert.equal(response.status,200);
  const body = await response.json(); assert.equal(body.liked,active); assert.equal(body.messageId,messageId);
  assert.equal(response.headers.get('cache-control'),'private, no-store');
}
assert(api.writes.every(body=>body.p_actor===actorId),'Actor must come from verified session, never request body');
assert.deepEqual(api.writes.map(body=>body.p_active),[true,true,false],'Explicit states make retries idempotent');

// Run the real button handlers: rapid double tap, optimistic state, canonical
// response, failed unlike rollback, sign-in gate, and fresh server values.
let cursor = 0; const state = [], refs = [], requests = [];
const exports = {};
vm.runInNewContext(compile('src/components/feed/CommentLikeButton.tsx'), {
  exports, AbortSignal,
  require(name) {
    if (name==='react') return {
      useState(initial) { const i=cursor++; if (!(i in state)) state[i]=initial; return [state[i],value=>state[i]=typeof value==='function'?value(state[i]):value]; },
      useRef(initial) { const i=cursor++; return refs[i] ||= {current:initial}; },
    };
    if (name==='react/jsx-runtime') return { jsx:(type,props)=>({type,...props}), jsxs:(type,props)=>({type,...props}) };
    throw Error(name);
  },
  fetch: (url,init) => new Promise(resolve=>requests.push({url,init,resolve})),
});
const props={threadId,messageId,authorName:'Other member',likes:3,liked:false,token:'session',surface:'ios'};
function render(next=props) { cursor=0; return exports.default(next); }
function button(tree) { return tree.children.find(child=>child?.type==='button'); }
let tree=render(); button(tree).onClick(); button(tree).onClick();
assert.equal(requests.length,1,'A rapid double tap must send one request');
tree=render(); assert.equal(button(tree)['aria-pressed'],true); assert.equal(button(tree).disabled,true);
assert(requests[0].url.endsWith('?surface=ios'),'Native visibility scope must be retained');
assert.equal(JSON.parse(requests[0].init.body).active,true);
requests[0].resolve({ok:true,json:async()=>({messageId,likes:5,liked:true})});
async function settle() { for(let i=0;i<12;i++) await Promise.resolve(); }
await settle(); tree=render(); assert.match(button(tree)['aria-label'],/5 likes/);
button(tree).onClick(); tree=render(); assert.equal(button(tree)['aria-pressed'],false);
requests[1].resolve({ok:false,json:async()=>({error:'Try again'})}); await settle(); tree=render();
assert.equal(button(tree)['aria-pressed'],true,'Failed unlike must restore the previous state');
assert(tree.children.some(child=>child?.role==='alert'));
tree=render({...props,likes:9,liked:true}); assert.match(button(tree)['aria-label'],/9 likes/,'Refreshed server counts supersede local snapshot');
tree=render({...props,token:null}); button(tree).onClick(); assert.equal(requests.length,2,'Signed-out viewers must not send writes');

const panel=fs.readFileSync('src/components/feed/ParticipationThreadPanel.tsx','utf8');
assert(panel.includes('message.kind !== "root"'),'Comment buttons must not duplicate post likes');
assert(panel.includes('session.user?.id || "guest"'),'Like state must reset between accounts');
assert(panel.includes('!message.deleted && !editing'),'Deleted messages must not offer likes');
const reader=fs.readFileSync('src/app/api/app/participation/threads/[id]/route.ts','utf8');
assert(reader.includes('participation_message_like_summary'),'Reopening conversations must restore persisted counts and viewer state');
console.log('Comment likes passed: verified actor, native visibility, blocks, deleted/mismatched messages, rate limits, optimistic response, retry states, rollback and account isolation.');

// Execute the actual thread loader with responses arriving out of order.
const threadSource=fs.readFileSync('src/components/feed/ParticipationThreadPanel.tsx','utf8');
const loaderSource=threadSource.slice(threadSource.indexOf('  const load = useCallback('),threadSource.indexOf('\n  useEffect(() => {',threadSource.indexOf('  const load = useCallback(')));
const loads=[], rendered=[];
const generation={current:0};
const scope={
  useCallback:fn=>fn, enabled:true, threadId, surface:'ios', authHeaders:()=>({}),
  loadGeneration:generation, summaryCallback:{current:()=>{}},
  setLoading:()=>{}, setError:()=>{}, setPayload:value=>rendered.push(value),
  fetch:()=>new Promise(resolve=>loads.push(resolve)),
};
vm.runInNewContext(ts.transpileModule(loaderSource+'\nglobalThis.runLoad=load;', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,scope);
const first=scope.runLoad(), second=scope.runLoad();
loads[1]({ok:true,json:async()=>({thread:{id:threadId},summary:{},messages:[{liked:false}]})}); await second;
loads[0]({ok:true,json:async()=>({thread:{id:threadId},summary:{},messages:[{liked:true}]})}); await first;
assert.equal(rendered.length,1,'Old thread responses must not overwrite the current account');
assert.equal(rendered[0].messages[0].liked,false);
const leaving=scope.runLoad(); generation.current++;
loads[2]({ok:true,json:async()=>({thread:{id:threadId},summary:{},messages:[{liked:true}]})}); await leaving;
assert.equal(rendered.length,1,'A response after account/thread cleanup must be ignored');
console.log('Comment viewer-state isolation passed for out-of-order loads and account/thread cleanup.');
