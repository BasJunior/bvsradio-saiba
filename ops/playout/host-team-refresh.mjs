#!/usr/bin/env node
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { factSheet, factFingerprint, artistKey, hostSessionAt } from '../../src/lib/station-host.mjs';

export const PROFILES = {
 daytime: { voiceId:'eleven-lily-day', providerId:'pFZP5JQG7iQjIQuC4Bku', speed:.94, name:'Lily' },
 evening: { voiceId:'eleven-george-evening', providerId:'JBFqnCBsd6RMkjVDRZzb', speed:.96, name:'George' },
 'after-hours': { voiceId:'eleven-lily-night', providerId:'pFZP5JQG7iQjIQuC4Bku', speed:.90, name:'Lily' },
};
export function introScript(facts, session, concise=false) {
 const intro = `Here's ${facts.spokenName}, with ${facts.title}.`;
 if (concise) return `You're listening to BVS Radio. ${intro}`;
 const variants = session === 'after-hours' ? [
  `You're with Lily on BVS Radio after hours. ${intro} Stay with the music.`,
  `Lily here, keeping you company on BVS Radio. ${intro} Settle in with the music.`,
  `BVS Radio after hours, with Lily. ${intro} A little more music for your night.`,
 ] : session === 'evening' ? [
  `George here on BVS Radio. ${intro} Stay with us for more music.`,
  `You're with George on BVS Radio. ${intro} Let's keep the music moving.`,
  `This is BVS Radio, with George. ${intro} More music on the way.`,
 ] : [
  `You're with Lily on BVS Radio. ${intro} Stay with us for more music.`,
  `Lily here, keeping you company on BVS Radio. ${intro} Enjoy the music.`,
  `This is BVS Radio, with Lily. ${intro} There's more music on the way.`,
 ];
 const index=createHash('sha256').update(`${facts.spokenName}|${facts.title}`).digest()[0]%variants.length;
 return variants[index];
}
export function audioCacheKey(script, profile) {
 return createHash('sha256').update(JSON.stringify({script, providerId:profile.providerId, speed:profile.speed, model:'eleven_multilingual_v2', stability:.45, similarity_boost:.75, style:.15, use_speaker_boost:true, format:'mp3_44100_128', version:1})).digest('hex');
}
export function eligibleTracks(view, session) {
 const profile=PROFILES[session]; if(!profile) throw new Error('Unknown host session');
 const used=new Set(view.usedSegmentIds||[]);
 const ready=(view.segments||[]).filter(s=>s.voiceId===profile.voiceId && s.status==='approved' && s.audioKey && !used.has(s.id) && Number(s.durationSeconds)>=8 && Number(s.durationSeconds)<=15 && (view.rotation||[]).some(t=>{const p=(view.pronunciations||[]).find(p=>(p.artistKey||p.artist_key)===artistKey(t.artistName)&&p.status==='approved'); return p && t.id===s.trackId && s.factFingerprint===factFingerprint(factSheet(t,p));})).length;
 if(ready>=12)return [];
 return (view.rotation||[]).flatMap(track=>{
  const pronunciation=(view.pronunciations||[]).find(p=>(p.artistKey||p.artist_key)===artistKey(track.artistName) && p.status==='approved');
  if(!pronunciation || !track.audioRef) return [];
  const facts=factSheet(track, pronunciation); if(!facts) return [];
  const fingerprint=factFingerprint(facts);
  const segments=(view.segments||[]).filter(s=>s.trackId===track.id && s.voiceId===profile.voiceId);
  if(segments.some(s=>s.status==='approved' && s.audioKey && Number(s.durationSeconds)>=8 && Number(s.durationSeconds)<=15 && !used.has(s.id) && s.factFingerprint===fingerprint)) return [];
  return [{track, facts, fingerprint, previous:segments.length}];
 }).sort((a,b)=>a.previous-b.previous || a.track.id.localeCompare(b.track.id)).slice(0,12-ready);
}
function loadEnv(file) {
 if(!existsSync(file))return;
 for(const line of readFileSync(file,'utf8').split('\n')){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}
}
function arg(name,fallback){const i=process.argv.indexOf(name);return i<0?fallback:process.argv[i+1];}
function duration(file){return Number(execFileSync('/usr/bin/ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',file],{encoding:'utf8'}).trim());}
function log(value){process.stdout.write(`${JSON.stringify(value)}\n`);}
async function synthesize(script,profile,cacheDir,key){
 mkdirSync(cacheDir,{recursive:true,mode:0o750});
 const file=path.join(cacheDir,`${audioCacheKey(script,profile)}.mp3`);
 if(existsSync(file)){try{const seconds=duration(file);if(seconds>=8&&seconds<=15)return {file,seconds,cached:true};}catch{ /* Regenerate a damaged cache entry. */ }}
 const durationMarker=file+'.duration.json';
 try{const rejected=JSON.parse(readFileSync(durationMarker,'utf8'));if(Date.now()-rejected.at<86400000)return {rejected:true,seconds:rejected.seconds};}catch{ /* No recent rejected variant. */ }
 let response;
 for(let attempt=0;attempt<3;attempt++){
 response=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${profile.providerId}?output_format=mp3_44100_128`,{method:'POST',headers:{'xi-api-key':key,'Content-Type':'application/json'},body:JSON.stringify({text:script.replace(/\bBVS\b/g,'B V S'),model_id:'eleven_multilingual_v2',voice_settings:{stability:.45,similarity_boost:.75,style:.15,use_speaker_boost:true,speed:profile.speed}}),signal:AbortSignal.timeout(60000)});
 if(response.status!==429 && response.status<500)break;
 if(attempt<2)await new Promise(resolve=>setTimeout(resolve,5000*(attempt+1)));
 }
 if(!response.ok)throw new Error(`Speech HTTP ${response.status}`);
 const temp=mkdtempSync(path.join(tmpdir(),'bvs-team-'));
 try{
  const input=path.join(temp,'speech.mp3');writeFileSync(input,Buffer.from(await response.arrayBuffer()),{mode:0o640});
  let seconds=duration(input);let chosen=input;
  if(seconds>=7 && seconds<8){chosen=path.join(temp,'padded.mp3');execFileSync('/usr/bin/ffmpeg',['-y','-hide_banner','-loglevel','error','-i',input,'-af','apad=whole_dur=8.05','-c:a','libmp3lame','-b:a','128k',chosen]);seconds=duration(chosen);}
  if(!Number.isFinite(seconds)||seconds<8||seconds>15){writeFileSync(durationMarker,JSON.stringify({at:Date.now(),seconds:Number.isFinite(seconds)?seconds:0}),{mode:0o640});return {rejected:true,seconds};}
  writeFileSync(file,readFileSync(chosen),{mode:0o640});return {file,seconds,cached:false};
 }finally{rmSync(temp,{recursive:true,force:true});}
}
export async function main(){
 const dry=process.argv.includes('--dry-run');const limit=Number(arg('--limit','6'));
 if(!Number.isInteger(limit)||limit<1||limit>24)throw new Error('Limit must be 1 to 24');
 loadEnv(process.env.BVS_HOST_DB_ENV||'/home/admin/.openclaw/secrets/bvs-supabase-db.env');
 loadEnv(process.env.BVS_HOST_R2_ENV||'/home/admin/.openclaw/secrets/bvs-r2.env');
 if(process.env.BVS_HOST_VOICE_ENV)loadEnv(process.env.BVS_HOST_VOICE_ENV);
 const pgRequire=createRequire('/opt/bvsradio/package.json');const {Pool}=pgRequire('pg');
 const pool=new Pool({connectionString:process.env.DATABASE_URL,max:2,ssl:{rejectUnauthorized:false}});
 const viewOf=async()=> (await pool.query('select public.bvs_station_engine_view($1) as payload',['bvs-main'])).rows[0].payload;
 try{
  let view=await viewOf();if(view.control?.hostStopped){log({result:'host_stopped'});return;}
  const requested=arg('--session',null);if(requested&&!PROFILES[requested])throw new Error('Unknown session');
  const current=hostSessionAt(new Date(),view.control?.roster).id;
  const upcoming=hostSessionAt(new Date(Date.now()+90*60000),view.control?.roster).id;
  const sessions=requested?[requested]:[...new Set([current,upcoming])];
  const cacheDir=process.env.BVS_HOST_CACHE_DIR||'/home/admin/.openclaw/cache/bvs-host-team';
  const pools=sessions.map(session=>eligibleTracks(view,session).filter(row=>{
   const marker=path.join(cacheDir,audioCacheKey(introScript(row.facts,session),PROFILES[session])+'.rejected.json');
   try{return Date.now()-JSON.parse(readFileSync(marker,'utf8')).at>86400000;}catch{return true;}
  }).map(row=>({...row,session})));
  const candidates=[]; for(let i=0;candidates.length<limit && pools.some(p=>p[i]);i++){for(const p of pools){if(p[i]&&candidates.length<limit)candidates.push(p[i]);}}
  if(dry){log({dryRun:true,sessions,candidates:candidates.map(c=>({trackId:c.track.id,session:c.session,voiceId:PROFILES[c.session].voiceId,script:introScript(c.facts,c.session)}))});return;}
  let apiKey=process.env.ELEVENLABS_API_KEY||process.env.ELEVEN_API_KEY;
  if(!apiKey){try{const c=JSON.parse(readFileSync('/home/admin/.openclaw/openclaw.json','utf8'));const v=c.messages?.tts?.providers?.elevenlabs?.apiKey;if(typeof v==='string')apiKey=v;}catch{}}
  if(!apiKey){try{const c=JSON.parse(readFileSync('/home/admin/.openclaw/secrets.json','utf8'));const v=c.providers?.elevenlabs?.apiKey;if(typeof v==='string')apiKey=v;}catch{}}
  if(!apiKey)throw new Error('Speech credential unavailable');
  const actor=(await pool.query("select user_id from editorial_staff where role='founder' and active is true order by user_id limit 1")).rows[0]?.user_id;
  if(!actor)throw new Error('No active founder');
  const awsRequire=createRequire(path.join(process.env.BVS_HOST_DEPENDENCY_ROOT||'/home/admin/.openclaw/workspace/bvsradio-station-host-2026-10-15','package.json'));
  const {S3Client,PutObjectCommand,HeadObjectCommand}=awsRequire('@aws-sdk/client-s3');
  const bucket=process.env.R2_BUCKET||'bvsradio-media';
  const s3=new S3Client({region:'auto',endpoint:process.env.R2_ENDPOINT||process.env.AWS_ENDPOINT_URL_S3,credentials:{accessKeyId:process.env.R2_ACCESS_KEY_ID||process.env.AWS_ACCESS_KEY_ID,secretAccessKey:process.env.R2_SECRET_ACCESS_KEY||process.env.AWS_SECRET_ACCESS_KEY}});
  let approved=0;
  for(const candidate of candidates){
   const {session,track}=candidate;const profile=PROFILES[session];
   view=await viewOf();if(view.control?.hostStopped)break;
   const fresh=eligibleTracks(view,session).find(c=>c.track.id===track.id);if(!fresh)continue;
   let script=introScript(fresh.facts,session);
   let audio=await synthesize(script,profile,process.env.BVS_HOST_CACHE_DIR||'/home/admin/.openclaw/cache/bvs-host-team',apiKey);
   if(audio.rejected){script=audio.seconds<8?`${script} Wherever you're listening from, stay with the music.`:introScript(fresh.facts,session,true);audio=await synthesize(script,profile,cacheDir,apiKey);}
   if(audio.rejected){writeFileSync(path.join(cacheDir,audioCacheKey(introScript(fresh.facts,session),profile)+'.rejected.json'),JSON.stringify({at:Date.now(),seconds:audio.seconds}),{mode:0o640});log({result:'duration_skipped',trackId:track.id,session});continue;}
   const latest=await viewOf();if(latest.control?.hostStopped)break;
   const still=eligibleTracks(latest,session).find(c=>c.track.id===track.id);if(!still)continue;
   // Broadcast counters may change during synthesis; the script contains no counters or first-play claims.
   if(introScript(still.facts,session)!==introScript(fresh.facts,session)){log({result:'facts_changed',trackId:track.id});continue;}
   const id=randomUUID(),audioKey=`station-host/${id}.mp3`;const bytes=readFileSync(audio.file);
   const destination=path.join(process.env.BVS_HOST_AUDIO_DIR||'/var/lib/bvs/station-host-audio',audioKey);
   execFileSync('sudo',['install','-d','-o','bvs','-g','bvs','-m','0750',path.dirname(destination)]);
   execFileSync('sudo',['install','-o','bvs','-g','bvs','-m','0640',audio.file,destination]);
   await s3.send(new PutObjectCommand({Bucket:bucket,Key:audioKey,Body:bytes,ContentType:'audio/mpeg',CacheControl:'public, max-age=86400'}));
   const head=await s3.send(new HeadObjectCommand({Bucket:bucket,Key:audioKey}));if(Number(head.ContentLength)!==bytes.length)throw new Error('Uploaded audio size mismatch');
   const client=await pool.connect();try{
    await client.query('begin');
    const saved=(await client.query("select public.bvs_station_save_segment($1::uuid,$2::uuid,'bvs-main','ai_voice',$3,$4::jsonb,$5,$6::uuid,$7,$8,$9,0,null) as payload",[actor,id,script,JSON.stringify(still.facts),still.fingerprint,track.id,artistKey(track.artistName),track.artistName,profile.voiceId])).rows[0].payload;
    const attached=(await client.query('select public.bvs_station_attach_audio($1::uuid,$2,$3::numeric,$4::integer) as payload',[id,audioKey,audio.seconds,saved.revision])).rows[0].payload;
    const result=(await client.query("select public.bvs_station_set_segment_status($1::uuid,$2::uuid,'approved',$3::integer) as payload",[actor,id,attached.revision])).rows[0].payload;
    if(result.status!=='approved')throw new Error('Approval failed');await client.query('commit');approved++;
   }catch(error){await client.query('rollback');throw error;}finally{client.release();}
   log({result:'approved',id,session,voiceId:profile.voiceId,duration:audio.seconds,cached:audio.cached});
  }
  log({result:'complete',approved,limit});
 }finally{await pool.end();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){main().catch(error=>{log({result:'failed',error:/^Speech HTTP \d+$/.test(error.message)?error.message:'Host refresh failed; inspect configuration and service health.'});process.exitCode=1;});}
