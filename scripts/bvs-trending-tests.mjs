import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
const { rankMovement } = await import('../src/lib/trending.ts')
assert.equal(rankMovement(7, 10, true), '↑3')
assert.equal(rankMovement(7, 5, true), '↓2')
assert.equal(rankMovement(7, null, true), 'NEW')
assert.equal(rankMovement(7, null, false), '—')
assert.equal(rankMovement(7, 7, true), '—')
const db = new PGlite()
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
 create table auth.users(id uuid primary key);
 create table public.tracks(id uuid primary key,user_id uuid,title text,artist_name text,file_url text,artwork_url text,duration_sec integer,is_public boolean,editorial_status text,in_rotation boolean default false);
 grant usage on schema public to service_role; grant select on tracks to service_role;`)
await db.exec(readFileSync('supabase/migrations/20261016190532_bvs_trending_momentum.sql','utf8'))
const owner=randomUUID(), listener=randomUUID()
await db.query('insert into auth.users values($1),($2)', [owner,listener])
const hot=randomUUID(),old=randomUUID(),spam=randomUUID(),hidden=randomUUID(),unapproved=randomUUID(),sparse=randomUUID()
for (const id of [hot,old,spam,hidden,unapproved,sparse]) await db.query(`insert into tracks(id,user_id,title,artist_name,file_url,duration_sec,is_public,editorial_status) values($1::uuid,$2,$1::text,'Artist','songs/test.mp3',200,$3,$4)`, [id,owner,id!==hidden,id===unapproved?'pending':'approved'])
const event=async(kind,track,play=randomUUID(),seconds=0,device='a'.repeat(64),network=null,user=null)=>db.query('select bvs_trending_event($1,$2,$3,$4,$5,$6,$7)',[kind,track,play,seconds,device,network,user])
const play=randomUUID()
await event('save',hot)
assert.equal((await db.query('select count(*)::int n from bvs_trending_actions')).rows[0].n,0,'unqualified saves cannot count')
await event('start',hot,play)
await event('listen',hot,play,30)
assert.equal((await db.query('select qualified_at from bvs_trending_sessions where play_id=$1',[play])).rows[0].qualified_at,null,'instant forged qualification rejected')
await db.query("update bvs_trending_sessions set started_at=now()-interval '35 seconds' where play_id=$1",[play])
await event('listen',hot,play,30,'b'.repeat(64))
assert.equal((await db.query('select qualified_at from bvs_trending_sessions where play_id=$1',[play])).rows[0].qualified_at,null,'cannot qualify another device session')
await event('listen',hot,play,30)
await event('complete',hot,play,160)
assert.equal((await db.query('select completed_at from bvs_trending_sessions where play_id=$1',[play])).rows[0].completed_at,null,'completion needs server elapsed time')
await db.query("update bvs_trending_sessions set started_at=now()-interval '170 seconds' where play_id=$1",[play])
await event('complete',hot,play,159)
assert.equal((await db.query('select completed_at from bvs_trending_sessions where play_id=$1',[play])).rows[0].completed_at,null,'completion needs actual media progression')
await event('complete',hot,play,160)
assert.ok((await db.query('select completed_at from bvs_trending_sessions where play_id=$1',[play])).rows[0].completed_at)
await event('save',hot); await event('save',hot); await event('share',hot); await event('share',hot)
assert.equal((await db.query('select count(*)::int n from bvs_trending_actions')).rows[0].n,2,'repeated saves/shares are idempotent')
await event('start',hidden); await event('start',unapproved)
assert.equal((await db.query('select count(*)::int n from bvs_trending_sessions where track_id in ($1,$2)',[hidden,unapproved])).rows[0].n,0)
// Fixture traffic is inserted directly, outside the ingest timer, to exercise full SQL scoring.
const seed=async(track,count,hoursAgo,{sameDevice=false,sameAccount=false,network=null,completed=false}={})=> {
 await db.query(`insert into bvs_trending_sessions(play_id,track_id,device_key,network_key,user_id,started_at,qualified_at,completed_at)
 select gen_random_uuid(),$1::uuid,case when $4 then 'spam-device' else $1::text||'-'||n::text end,$6,case when $5 then $7::uuid else null end,
 date_trunc('hour',now())-make_interval(hours=>$3::int)-interval '5 minutes',date_trunc('hour',now())-make_interval(hours=>$3::int),
 case when $8 then date_trunc('hour',now())-make_interval(hours=>$3::int) end from generate_series(1,$2::int) n`,[track,count,hoursAgo,sameDevice,sameAccount,network,listener,completed])
}
await seed(hot,150,1,{completed:true}); await seed(old,5000,200); await seed(old,15,4)
await seed(spam,500,1,{sameDevice:true}); await seed(hidden,100,1); await seed(unapproved,100,1); await seed(sparse,4,1)
await db.exec('set role service_role; select bvs_refresh_trending(); reset role;')
const board=async(window='now')=>(await db.query('select bvs_trending_board($1) board',[window])).rows[0].board
let first=await board()
assert.equal(first.entries[0].id,hot,'150 real new listeners beat historical 5,000 plays')
assert.equal(first.hasPrevious,false,'first chart does not invent rank movement')
assert.deepEqual(new Set(first.entries.map(x=>x.id)),new Set([hot,old]),'same-device spam, <5 listeners, hidden/unapproved songs excluded')
assert.equal((await board('week')).entries[0].id,hot,'week also excludes old lifetime plays')
assert.equal((await db.query('select count(*)::int n from tracks where in_rotation')).rows[0].n,0,'chart never changes rotation')
await db.exec('select bvs_refresh_trending()')
assert.equal((await db.query('select count(*)::int n from bvs_trending_runs')).rows[0].n,2,'retry same hour does not fabricate a comparison chart')
// Simulate an earlier snapshot and alter momentum; stable rank history must survive.
// FK intentionally prevents moving rankings without their run; use a copied historical run instead.
await db.exec(`insert into bvs_trending_runs select window_key,generated_at-interval '1 hour' from bvs_trending_runs;
 insert into bvs_trending_rankings select window_key,generated_at-interval '1 hour',track_id,3-rank,score,listeners,reason from bvs_trending_rankings;`)
first=await board()
assert.equal(first.hasPrevious,true)
assert.equal(first.entries[0].previousRank,2)
assert.equal(rankMovement(first.entries[0].rank,first.entries[0].previousRank,first.hasPrevious),'↑1')
assert.equal(rankMovement(first.entries[1].rank,first.entries[1].previousRank,first.hasPrevious),'↓1')
await db.query("delete from bvs_trending_rankings where track_id=$1 and generated_at=date_trunc('hour',now())-interval '1 hour'",[old])
assert.equal((await board()).entries.find(x=>x.id===old).previousRank,null,'new entries have no fabricated previous rank')
await db.query('update tracks set is_public=false where id=$1',[hot])
assert.equal((await board()).entries.some(x=>x.id===hot),false,'unpublished song immediately disappears despite saved snapshot')
// One account across many devices cannot manufacture listeners.
const accountSpam=randomUUID(),networkSpam=randomUUID()
for(const id of [accountSpam,networkSpam]) await db.query(`insert into tracks(id,user_id,title,artist_name,file_url,duration_sec,is_public,editorial_status) values($1::uuid,$2,$1::text,'Artist','songs/x.mp3',200,true,'approved')`,[id,owner])
await seed(accountSpam,200,1,{sameAccount:true}); await seed(networkSpam,200,1,{network:'same-network'})
await db.exec('delete from bvs_trending_runs; select bvs_refresh_trending();')
assert.equal((await board()).entries.some(x=>x.id===accountSpam),false)
assert.equal((await db.query('select listeners from bvs_trending_rankings where track_id=$1 and window_key=\'now\'',[networkSpam])).rows[0].listeners,20,'network bursts capped')
for (const role of ['anon','authenticated']) {
 await db.exec(`set role ${role}`)
 await assert.rejects(()=>db.query("select bvs_trending_board('now')"),/permission denied/)
 await assert.rejects(()=>db.query('select * from bvs_trending_sessions'),/permission denied/)
 await assert.rejects(()=>db.query('select bvs_refresh_trending()'),/permission denied/)
 await assert.rejects(()=>event('start',hot),/permission denied/)
 await db.exec('reset role')
}
await db.close()
console.log('BVS Trending: scoring, ingest proof, deduplication, snapshots, eligibility, rotation isolation and permissions passed.')
