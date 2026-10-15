import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import {randomUUID,webcrypto} from 'node:crypto'
import {PGlite} from '@electric-sql/pglite'
function load(path,imports={},globals={}) {
 const exports={};const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 vm.runInNewContext(code,{exports,require:n=>{if(n in imports)return imports[n];throw new Error(`Unexpected import ${n}`)},console,crypto:webcrypto,AbortSignal,setTimeout,...globals},{filename:path});return exports
}
const lib=load('src/lib/beat-crate.ts')
const payload=lib.newCratePayload();payload.rights=true
payload.items=Array.from({length:25},(_,n)=>({...lib.newCrateItem(),title:`Beat ${n}`,previewPath:`beats/u/${n}.mp3`,price:'29'}))
assert.equal(lib.crateValidation(payload,true),null)
assert.match(lib.crateValidation({...payload,items:[...payload.items,lib.newCrateItem()]},true),/1–25/)
assert.match(lib.crateValidation({...payload,rights:false},true),/rights/)
assert.match(lib.crateValidation({...payload,challenge:true},true),/cover art/)
assert.match(lib.crateValidation({...payload,items:[{...payload.items[0],price:'NaN'}]},true),/price/)
assert.match(lib.crateValidation({...payload,items:[{...payload.items[0],bpm:'Infinity'}]},true),/BPM/)
assert.equal(lib.validInstagram('@basjunior'),true);assert.equal(lib.validInstagram('https://instagram.com/user'),false)
assert.equal(lib.titleFromFile('Midnight_Drive.wav'),'Midnight Drive')
const beats=Array.from({length:25},(_,n)=>({status:'approved',preview_path:`p${n}`,submitted_at:new Date(Date.UTC(2026,9,16,0,n)).toISOString()}))
const progress=lib.crateProgress([...beats,{...beats[0]},{status:'submitted'},{status:'changes_requested'}],{avatar_url:'photo.jpg',is_producer:true},'producer')
assert.equal(progress.approved,25);assert.equal(progress.pending,1);assert.equal(progress.changes,1);assert.equal(progress.submittedAt,beats[24].submitted_at);assert.equal(progress.readyForVerification,true)
assert.equal(lib.crateProgress(beats,{avatar_url:'/assets/images/default-avatar.png',is_producer:true},'producer').readyForVerification,false)
const db=new PGlite()
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table public.profiles(id uuid primary key,role text,is_producer boolean);`)
const beatSql=readFileSync('supabase-beatstore-mvp.sql','utf8')
await db.exec(beatSql.slice(beatSql.indexOf('create table if not exists public.beats'),beatSql.indexOf('create index if not exists beat_licence_beat_idx')))
const packSql=readFileSync('supabase-beat-packs.sql','utf8')
await db.exec(packSql.slice(packSql.indexOf('create table'),packSql.indexOf('alter table public.beat_packs enable')))
const migration=readFileSync('supabase/migrations/20261015211020_beat_crate_launch_readiness.sql','utf8')
await db.exec(migration)
const owner=randomUUID(),other=randomUUID(),draft=randomUUID()
await db.query('insert into auth.users values ($1),($2)',[owner,other]);await db.query("insert into profiles values($1,'listener',true),($2,'listener',true)",[owner,other])
const insertDraft=async(id)=>{await db.query('insert into beat_upload_drafts(id,user_id,payload) values($1,$2,$3)',[id,owner,{...payload,rights:true}]);return (await db.query('select updated_at::text from beat_upload_drafts where id=$1',[id])).rows[0].updated_at}
const stamp=await insertDraft(draft)
const items=payload.items.map((item,i)=>({...item,previewPath:`beats/${owner}/${i}.mp3`,slug:`beat-${randomUUID()}`,audioHash:i.toString(16).padStart(64,'0'),licence:{licence_name:'Standard Lease',included_files:['preview','master'],terms_version:'standard_lease-v1',terms_summary:'Terms'}}))
const finalize=(uid,id,at,list)=>db.query('select public.finalize_beat_upload($1,$2,$3,$4) as result',[uid,id,at,list])
await assert.rejects(()=>finalize(other,draft,stamp,items),/not found/)
await assert.rejects(()=>finalize(owner,draft,'2020-01-01',items),/Draft changed/)
const first=(await finalize(owner,draft,stamp,items)).rows[0].result
assert.equal(first.count,25)
const retry=(await finalize(owner,draft,stamp,items)).rows[0].result
assert.deepEqual(retry,first)
assert.equal((await db.query('select count(*)::int as n from beats')).rows[0].n,25)
assert.equal((await db.query('select count(*)::int as n from beat_licence_options')).rows[0].n,25)
const duplicate=randomUUID(),stamp2=await insertDraft(duplicate)
await assert.rejects(()=>finalize(owner,duplicate,stamp2,items),/unique/)
assert.equal((await db.query('select count(*)::int as n from beat_packs')).rows[0].n,1,'duplicate failure rolls back the entire pack')
const bad=randomUUID(),stamp3=await insertDraft(bad)
const broken=items.map((i,n)=>({...i,audioHash:(n+100).toString(16).padStart(64,'0'),slug:randomUUID(),licence:{...i.licence,terms_summary:n===24?null:'terms'}}))
await assert.rejects(()=>finalize(owner,bad,stamp3,broken),/not-null/)
assert.equal((await db.query('select count(*)::int as n from beats')).rows[0].n,25,'licence failure cannot leave partial beats')
assert.equal((await db.query('select state from beat_upload_drafts where id=$1',[bad])).rows[0].state,'draft')
for(const role of ['anon','authenticated']){
 const grants=(await db.query(`select has_table_privilege($1,'public.beat_upload_drafts','select') as drafts,has_function_privilege($1,'public.finalize_beat_upload(uuid,uuid,timestamptz,jsonb)','execute') as rpc`,[role])).rows[0]
 assert.equal(grants.drafts,false);assert.equal(grants.rpc,false)
}
// A 25-beat retry must not fan out another upload after the receipt exists.
const receiptApi=load('src/app/api/beats/crate/route.ts',{
 'next/server':{NextResponse:{json:(body,init)=>({body,status:init?.status||200})}},
 'node:crypto':{randomUUID},'@/lib/beatstore-server':{beatIdentity:async()=>({user:{id:owner},profile:{is_producer:true}}),beatHeaders:{},beatUrl:p=>p,slugifyBeat:s=>s},
 '@/lib/r2-storage':{r2ObjectExists:()=>{throw new Error('receipt recovery must not inspect or upload files')}},
 '@/lib/beat-licences':{licenceOptionSeed:()=>({})},'@/lib/beat-crate':lib,
},{fetch:async()=>({ok:true,json:async()=>[{state:'submitted',result:first}]}),URL,Request,Response})
assert.equal((await receiptApi.POST(new Request('https://bvsradio.com/api/beats/crate',{method:'POST',body:JSON.stringify({id:draft})}))).body.result.count,25)
const single=randomUUID(),singleStamp=await insertDraft(single)
const singleResult=(await finalize(owner,single,singleStamp,[{...items[0],audioHash:'f'.repeat(64),slug:randomUUID()}])).rows[0].result
assert.equal(singleResult.count,1);assert.equal(singleResult.packId,null)
const imports={
 'next/server':{NextResponse:{json:(body,init)=>({body,status:init?.status||200})}},'node:crypto':{randomUUID},
 '@/lib/beatstore-server':{beatIdentity:async()=>({user:{id:owner},profile:{is_producer:true}}),beatHeaders:{},beatUrl:p=>p,slugifyBeat:s=>s},
 '@/lib/r2-storage':{r2ObjectExists:async()=>false},'@/lib/beat-licences':{licenceOptionSeed:()=>({})},'@/lib/beat-crate':lib,
}
const route=(overrides={},fetcher=async()=>{throw new Error('Unexpected database request')})=>load('src/app/api/beats/crate/route.ts',{...imports,...overrides},{fetch:fetcher,URL,Request,Response})
const noAuth=route({'@/lib/beatstore-server':{...imports['@/lib/beatstore-server'],beatIdentity:async()=>null}})
assert.equal((await noAuth.GET(new Request('https://bvsradio.com/api/beats/crate'))).status,401)
const foreignPayload={...payload,items:[{...payload.items[0],previewPath:`beats/${other}/stolen.mp3`}]}
assert.equal((await route().PUT(new Request('https://bvsradio.com/api/beats/crate',{method:'PUT',body:JSON.stringify({id:randomUUID(),payload:foreignPayload})}))).status,400)
let mutations=0
const stale=route({},async(path,init)=>{if(init.method)mutations++;return {ok:true,json:async()=>[{state:'draft',updated_at:'new-version'}]}})
const ownPayload={...payload,items:[{...payload.items[0],previewPath:`beats/${owner}/own.mp3`}]}
assert.equal((await stale.PUT(new Request('https://bvsradio.com/api/beats/crate',{method:'PUT',body:JSON.stringify({id:randomUUID(),updatedAt:'old-version',payload:ownPayload})}))).status,409)
assert.equal(mutations,0,'a stale browser tab cannot overwrite newer work')
let rpcCalls=0
const incomplete=route({},async(path)=>{if(path.startsWith('rpc/'))rpcCalls++;return {ok:true,json:async()=>[{id:draft,state:'draft',payload:ownPayload,updated_at:'stamp'}]}})
assert.equal((await incomplete.POST(new Request('https://bvsradio.com/api/beats/crate',{method:'POST',body:JSON.stringify({id:draft})}))).status,400)
assert.equal(rpcCalls,0,'missing media must never enter editorial review')
await db.close();console.log('Beat crate: 25-file validation, eligibility, timestamp ordering, atomic rollback, ownership, duplicate prevention, receipt recovery and private grants passed.')
