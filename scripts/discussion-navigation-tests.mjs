import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const read=path=>fs.readFileSync(path,'utf8');
function load(path,imports={},globals={}) {
 const exports={}; vm.runInNewContext(ts.transpileModule(read(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,URL,...globals,require:name=>{if(name in imports)return imports[name];throw Error(name)}});return exports;
}
const tree=load('src/lib/discussion-tree.ts').discussionForest;
const messages=[{id:'root',kind:'root',replyToId:null},{id:'a',kind:'reply',replyToId:'root'},{id:'b',kind:'reply',replyToId:'a'},{id:'c',kind:'reply',replyToId:'b'},{id:'orphan',kind:'reply',replyToId:'unloaded'},{id:'loop-a',kind:'reply',replyToId:'loop-b'},{id:'loop-b',kind:'reply',replyToId:'loop-a'}];
const forest=tree(messages);
assert.equal(forest.find(node=>node.message.id==='a').children[0].children[0].message.id,'c');
assert(forest.some(node=>node.message.id==='orphan'),'Unloaded parent must not hide a reply');
assert(forest.some(node=>node.message.id==='loop-a'),'Malformed cycles must not recurse forever');
const policy=load('src/lib/participation-delivery-policy.ts',{'server-only':{},'@/lib/participation-server':{}});
const id='11111111-1111-4111-8111-111111111111'; const mid='22222222-2222-4222-8222-222222222222';
for(const surface of [null,'ios','android']) assert.equal(policy.notificationHref(`/participation/thread/${id}#reply-${mid}`,surface),`${surface?`/app/${surface}`:''}/feed/${id}#reply-${mid}`);
const urls=load('src/lib/share-url.ts');
assert.equal(urls.canonicalBvsShareUrl(`/app/ios/feed/${id}#reply-${mid}`),`https://bvsradio.com/feed/${id}#reply-${mid}`);
const jsx={jsx:(type,props)=>({type,...props}),jsxs:(type,props)=>({type,...props})};
let copied='',notice='',shared;
const share=load('src/components/feed/CommentShareButton.tsx',{'react/jsx-runtime':jsx,'@/lib/share-url':urls},{navigator:{clipboard:{writeText:async text=>copied=text},share:async data=>shared=data}}).default;
const component=share({threadId:id,messageId:mid,authorName:'Member',body:'A comment',onNotice:text=>notice=text});
component.children[1].onClick();for(let i=0;i<6;i++)await Promise.resolve();
assert.equal(copied,`https://bvsradio.com/feed/${id}#reply-${mid}`);assert.equal(notice,'Comment link copied.');
component.children[0].onClick();for(let i=0;i<6;i++)await Promise.resolve();assert.equal(shared.url,copied);
const panel=read('src/components/feed/ParticipationThreadPanel.tsx');
assert(panel.includes('Load more comments')&&panel.includes('setSort(event.target.value)'));
assert(panel.includes('discussionForest(conversation)')&&panel.includes('containsFocus(node)'));
assert(panel.includes('scrollIntoView')&&panel.includes('await load(false, undefined, data.messageId)'));
assert(panel.includes('FeedMoreActions')&&panel.includes('onNotice={setShareNotice}'));
const notifications=read('src/lib/participation-notifications-server.ts');
assert(notifications.includes('group_participation_comment_like')&&notifications.includes('message_liked'));
assert(read('src/lib/participation-push-server.ts').includes('push:${notification.id}'),'Grouped updates must reuse existing per-notification push dedupe');
const member=read('src/app/api/app/participation/members/[id]/route.ts');
assert(member.includes('blockedPair')&&member.includes('participationVisibleThread')&&member.includes('metadata.is_published ? metadata.bio'));
// Execute the real request parser and member endpoint across privacy states.
const reader=read('src/app/api/app/participation/threads/[id]/route.ts');
const getSource=reader.slice(reader.indexOf('export async function GET('),reader.indexOf('export async function PATCH('));
const parsed=[];const readerExports={};
vm.runInNewContext(ts.transpileModule(getSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:readerExports,URL,Buffer,Date,NextResponse:{json:Response.json},participationEnabled:()=>true,participationReady:()=>true,requireAppUser:async()=>null,participationRequestSurface:()=> 'ios',loadThread:async (...args)=>{parsed.push(args);return {thread:{id}};}});
const params={params:Promise.resolve({id})};
const cursor=Buffer.from(JSON.stringify({at:'2026-10-12T00:00:00Z',id:mid,likes:3})).toString('base64url');
assert.equal((await readerExports.GET(new Request(`https://bvsradio.com/api/thread?sort=top&cursor=${cursor}&focus=${mid}`),params)).status,200);
assert.equal(parsed[0][3].sort,'top');assert.equal(parsed[0][3].cursor.id,mid);assert.equal(parsed[0][3].focus,mid);
assert.equal((await readerExports.GET(new Request('https://bvsradio.com/api/thread?cursor=invalid'),params)).status,400);
assert.equal(parsed.length,1,'Malformed cursors must not reach the database');
function memberAPI({published=false,visible=true,blocked=false}={}) {
 return load('src/app/api/app/participation/members/[id]/route.ts',{'next/server':{NextResponse:{json:Response.json}},'@/lib/app-api-auth':{requireAppUser:async()=>({id:mid})},'@/lib/participation-route':{withParticipationErrors:run=>run()},'@/lib/participation-server':{
 participationEnabled:()=>true,participationReady:()=>true,participationRequestSurface:()=> 'ios',blockedPair:async()=>blocked,
 participationRows:async path=>path.startsWith('profiles?')?[{is_published:published,bio:'Creator bio',username:'member'}]:[{id:mid,thread_id:id,message_kind:'reply',body:'Public comment',created_at:'2026-10-12'}],
 participationVisibleThread:async()=>visible?{id}:null,loadParticipationProfiles:async()=>[{id,displayName:'Member',avatarUrl:null,username:'member'}],
 }}).GET;
}
for(const [options,status] of [[{blocked:true},404],[{published:false,visible:false},404],[{published:false,visible:true},200],[{published:true,visible:false},200]]) {
 const result=await memberAPI(options)(new Request('https://bvsradio.com/api/member'),params);assert.equal(result.status,status);
 if(status===200){const body=await result.json();assert.equal(body.bio,options.published?'Creator bio':'');assert.equal(body.activity.length,options.visible?1:0);if(!options.published)assert.equal(body.creatorHref,null);}
}
console.log('Discussion navigation passed: reply trees/cycles, exact web/native links, sharing/copy feedback, pagination controls, grouped notification dispatch and public-profile boundaries.');
