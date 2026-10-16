import test from 'node:test';
import assert from 'node:assert/strict';
import { PROFILES, introScript, audioCacheKey, eligibleTracks } from './host-team-refresh.mjs';
import { factSheet, factFingerprint } from '../../src/lib/station-host.mjs';
const track={id:'track-1',artistName:'Artist',title:'A Song',audioRef:'https://example.test/audio.mp3',priorBroadcasts:1};
const pronunciation={artistKey:'artist',status:'approved',spokenForm:'Artist'};
const view={rotation:[track],pronunciations:[pronunciation],segments:[],usedSegmentIds:[]};
test('only approved pronunciations can enter synthesis',()=>{
 assert.equal(eligibleTracks(view,'daytime').length,1);
 assert.equal(eligibleTracks({...view,pronunciations:[]},'daytime').length,0);
 assert.equal(eligibleTracks({...view,pronunciations:[{...pronunciation,status:'rejected'}]},'daytime').length,0);
});
test('fresh unused voice is not regenerated; used or stale voice is replenished',()=>{
 const facts=factSheet(track,pronunciation);
 const segment={id:'segment-1',trackId:track.id,voiceId:PROFILES.daytime.voiceId,status:'approved',audioKey:'station-host/a.mp3',durationSeconds:10,factFingerprint:factFingerprint(facts)};
 const ready={...view,segments:[segment]};
 assert.equal(eligibleTracks(ready,'daytime').length,0);
 assert.equal(eligibleTracks(ready,'evening').length,1);
 assert.equal(eligibleTracks({...ready,usedSegmentIds:['segment-1']},'daytime').length,1);
 assert.equal(eligibleTracks({...ready,rotation:[{...track,priorBroadcasts:2}]},'daytime').length,1);
});
test('broadcast changes reuse speech cache without reusing stale factual fingerprints',()=>{
 const a=factSheet(track,pronunciation),b=factSheet({...track,priorBroadcasts:42},pronunciation);
 assert.notEqual(factFingerprint(a),factFingerprint(b));
 assert.equal(introScript(a,'daytime'),introScript(b,'daytime'));
 assert.equal(audioCacheKey(introScript(a,'daytime'),PROFILES.daytime),audioCacheKey(introScript(b,'daytime'),PROFILES.daytime));
 assert.notEqual(audioCacheKey(introScript(a,'daytime'),PROFILES.daytime),audioCacheKey(introScript(a,'daytime'),PROFILES['after-hours']));
 assert.doesNotMatch(introScript(a,'daytime'),/first|chart|popular/i);
});
test('least represented eligible tracks get replenished first',()=>{
 const rows=eligibleTracks({...view,rotation:[track,{...track,id:'track-2'}],segments:[{trackId:'track-1',voiceId:PROFILES.daytime.voiceId,status:'approved'}]},'daytime');
 assert.equal(rows[0].track.id,'track-2');
});
test('ready inventory is capped at twelve per session',()=>{
 const tracks=Array.from({length:13},(_,i)=>({...track,id:`track-${i}`}));
 const segments=tracks.slice(0,12).map((t,i)=>({id:`segment-${i}`,trackId:t.id,voiceId:PROFILES.daytime.voiceId,status:'approved',audioKey:`station-host/${i}.mp3`,durationSeconds:10,factFingerprint:factFingerprint(factSheet(t,pronunciation))}));
 assert.equal(eligibleTracks({...view,rotation:tracks,segments},'daytime').length,0);
 assert.equal(eligibleTracks({...view,rotation:tracks,segments},'evening').length,12);
});
