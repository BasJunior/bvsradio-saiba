import assert from 'node:assert/strict';
import { hostSessionAt, planExtension, factSheet, factFingerprint } from '../src/lib/station-host.mjs';
import { runStationEngine } from '../ops/playout/station-engine.mjs';
const roster = [
 {id:'daytime',hostName:'Lily',voiceId:'eleven-lily-day'},
 {id:'evening',hostName:'George',voiceId:'eleven-george-evening'},
 {id:'after-hours',hostName:'Lily',voiceId:'eleven-lily-night'},
];
for (const [time,voice] of [['03:59','eleven-lily-night'],['04:00','eleven-lily-day'],['13:59','eleven-lily-day'],['14:00','eleven-george-evening'],['19:59','eleven-george-evening'],['20:00','eleven-lily-night']]) {
 assert.equal(hostSessionAt(`2026-10-16T${time}:00Z`,roster).voiceId,voice);
}
const tracks = Array.from({length:12},(_,i)=>({id:`track-${i}`,title:`Song ${i}`,artistName:'Artist',audioRef:'/music.mp3',durationSeconds:180}));
const clip = (voiceId,i) => ({id:`clip-${voiceId}-${i}`,voiceId,trackId:tracks[i].id,kind:'ai_voice',status:'approved',audioKey:'station-host/sample.mp3',durationSeconds:10,factFingerprint:factFingerprint(factSheet(tracks[i]))});
const settings={enabled:true,minGap:3,maxGap:5,roster};
const night = planExtension({rotation:tracks,segments:[clip('eleven-lily-night',5)],settings,horizon:8,now:'2026-10-16T21:00:00Z'});
assert.equal(night.findIndex(i=>i.kind==='ai_voice'),5);
const wrong = planExtension({rotation:tracks,segments:[clip('samantha',3),clip('eleven-lily-day',4)],settings,horizon:8,now:'2026-10-16T15:00:00Z'});
assert.ok(wrong.every(i=>i.kind==='music'));
const fails=[];
await runStationEngine({maxSteps:1,horizon:0,now:()=>new Date('2026-10-16T14:00:00Z'),output:{mode:'timeline',open:async()=>{throw new Error('wrong host reached output');}},store:{heartbeat:async()=>{},view:async()=>({control:settings,segments:[clip('eleven-lily-day',3)],scheduled:[{id:'queued',kind:'ai_voice',segmentId:clip('eleven-lily-day',3).id}]}),fail:async(_p,_i,r)=>fails.push(r)}});
assert.deepEqual(fails,['host_session_changed']);
let planned;
await runStationEngine({maxSteps:1,now:()=>new Date('2026-10-16T13:59:00Z'),horizon:2,output:{mode:'timeline',open:async()=>{},untilEnd:async()=>{}},store:{heartbeat:async()=>{},view:async()=>({control:settings,rotation:tracks,segments:[clip('eleven-george-evening',1)],musicSinceVoice:3,scheduled:[{id:'music',kind:'music',trackId:tracks[0].id,durationSeconds:180}],undelivered:[]}),plan:async(_p,items)=>planned=items,begin:async()=>({}),finish:async()=>{}}});
assert.equal(planned[0].kind,'ai_voice');
assert.equal(planned[0].title,'George');
assert.equal(planned[1].trackId,tracks[1].id);
console.log('Host-team scheduler passed: Harare boundaries, overnight spacing, no foreign voice fallback, playback handover, queue-time projection, rotation continuation.');
const currentClip=clip('eleven-lily-day',3);
const refreshed=planExtension({rotation:tracks,segments:[{...currentClip,id:'stale',factFingerprint:'old'},currentClip],settings,horizon:5,now:'2026-10-16T09:00:00Z'});
assert.ok(refreshed.some(i=>i.segmentId===currentClip.id),'Stale approved audio must not hide a fresh replacement');
