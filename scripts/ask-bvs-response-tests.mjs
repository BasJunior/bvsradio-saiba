import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports = {};
const beats = [
  { id:'fast',title:'Night Drive',genre:'Hip-Hop',mood:'Dark',bpm:140,producer_user_id:'producer' },
  { id:'slow',title:'Low Light',genre:'Hip-Hop',mood:'Dark',bpm:90,producer_user_id:'producer' },
  { id:'other',title:'Sunrise',genre:'Jazz',mood:'Bright',bpm:120,producer_user_id:'other-producer' },
];
const imports = {
  'server-only': {},
  '@/lib/station-content': { getPublicProgrammes: async()=>[{slug:'studio-stories',title:'Studio Stories',tagline:'Conversations about making music',schedule:'See programme'}] },
  '@/lib/catalogue-curated-tracks': { curatedCatalogueTracks: [] },
  '@/lib/catalogue-listings': { listCatalogueMusicListings: async () => ({ listings:[{id:'track',title:'Unknown Tempo',artist:'Artist',genre:'Jazz',collection:'Single',source:'track'}] }) },
  '@/lib/artist-content': { getPublishedArtists: async()=>[], getPublishedProducers:async()=>[] },
  '@/lib/public-releases': { getPublicReleases:async()=>[] },
  '@/lib/media-url': { mediaUrlForStoredValue:value=>value },
  '@/lib/public-name': { producerPublicName:profile=>profile.username },
};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/ask-bvs-flow.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, {
  exports, AbortSignal, process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://test.invalid',SUPABASE_SERVICE_ROLE_KEY:'test'}},
  fetch:async url=>({ok:true,json:async()=>url.includes('/beats?')?beats:[{id:'producer',username:'Wolf Bridges'},{id:'other-producer',username:'Other'}]}),
  require:name=>{if(name in imports)return imports[name];throw Error(name);},
});
const answer=exports.answerAskBvs;
let result=await answer('Find dark hip hop beats');
assert.equal(result.objects.length,2);assert(result.objects.every(item=>item.kind==='beat'));assert(result.objects[0].matchReason.includes('Dark'));
result=await answer('Find beats at 120 BPM');assert.equal(result.objects.length,1);assert.equal(result.objects[0].id,'other');
result=await answer('Find beats by Wolf Bridges');assert.equal(result.objects.length,2);
const context={previousResults:[{id:'fast',kind:'beat'}],shownIds:['beat:fast']};
result=await answer('something slower',context);assert.equal(result.objects[0].id,'other');assert(result.objects.every(item=>item.bpm<140));assert(result.objects[0].matchReason.includes('slower than Night Drive'));
result=await answer('more like this',context);assert.equal(result.objects.length,1);assert.equal(result.objects[0].id,'slow');assert.equal(result.objects[0].matchReason,'Same listed genre: Hip-Hop');
result=await answer('more like this',{...context,shownIds:['beat:fast','beat:slow']});assert.equal(result.objects.length,0,'Do not repeat already-shown suggestions');
result=await answer('something slower',{previousResults:[{id:'track',kind:'track'}]});assert.equal(result.reason,'tempo_unknown');
result=await answer('more like this',{previousResults:[{id:'forged',kind:'beat',title:'Invented facts',bpm:999}]});assert.equal(result.reason,'followup_needs_reference');assert(!result.reply.includes('Invented'));
result=await answer('recommend purple underwater beats');assert.equal(result.objects.length,0);assert(result.reply.includes('couldn’t find'));
result=await answer('recommend shows');assert.equal(result.objects[0].title,'Studio Stories');
console.log('Ask BVS passed: factual discovery filters, producer matching, BPM comparisons, explained follow-ups, no repeats, unknown tempo and untrusted references.');
