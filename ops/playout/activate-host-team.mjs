#!/usr/bin/env node
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {factSheet,factFingerprint,artistKey} from '../../src/lib/station-host.mjs';
import {PROFILES} from './host-team-refresh.mjs';
const apply=process.argv.includes('--apply');
const env=Object.fromEntries(readFileSync('/home/admin/.openclaw/secrets/bvs-supabase-db.env','utf8').split('\n').flatMap(l=>{const m=l.match(/^([A-Z0-9_]+)=(.*)$/);return m?[[m[1],m[2].trim().replace(/^['"]|['"]$/g,'')]]:[]}));
const {Pool}=createRequire('/opt/bvsradio/package.json')('pg');
const pool=new Pool({connectionString:env.DATABASE_URL,ssl:{rejectUnauthorized:false},max:1});
try {
 const view=(await pool.query("select public.bvs_station_engine_view('bvs-main') as payload")).rows[0].payload;
 const used=new Set(view.usedSegmentIds||[]);
 const ready={};
 for(const [session,profile] of Object.entries(PROFILES)) ready[session]=(view.segments||[]).filter(s=>s.voiceId===profile.voiceId&&!used.has(s.id)&&s.audioKey&&s.durationSeconds>=8&&s.durationSeconds<=15&&(view.rotation||[]).some(t=>{const p=(view.pronunciations||[]).find(p=>p.artistKey===artistKey(t.artistName)&&p.status==='approved');return p&&t.id===s.trackId&&s.factFingerprint===factFingerprint(factSheet(t,p));})).length;
 const roster=(await pool.query("select * from station_host_sessions where programme_id='bvs-main' order by starts_minute")).rows;
 const old=(await pool.query("select id,revision,status,voice_id from station_voice_segments where programme_id='bvs-main' and voice_id='samantha' and status='approved'")).rows;
 console.log(JSON.stringify({apply,ready,roster:roster.map(r=>({session:r.session_id,host:r.host_name,voice:r.voice_id})),oldApproved:old.length,onAir:view.onAir?.kind}));
 if(apply){
  if(Object.values(ready).some(n=>n<3))throw new Error('Need at least three fresh clips per show');
  if(view.control?.hostStopped)throw new Error('Host was manually stopped');
  const actor=(await pool.query("select user_id from editorial_staff where role='founder' and active is true order by user_id limit 1")).rows[0]?.user_id;
  if(!actor)throw new Error('No founder actor');
  const dir='/home/admin/.openclaw/backups/bvs-host-team-20261016';mkdirSync(dir,{recursive:true,mode:0o700});
  const backup=`${dir}/activation-${Date.now()}.json`;writeFileSync(backup,JSON.stringify({roster,old,control:view.control},null,2),{mode:0o600});
  await pool.query('begin');
  try {
   for(const row of roster){const profile=PROFILES[row.session_id];if(!profile)continue;
    await pool.query('select public.bvs_station_set_session_voice($1::uuid,$2,$3,$4,$5,$6::integer)',[actor,'bvs-main',row.session_id,profile.name,profile.voiceId,row.revision]);
   }
   for(const row of old)await pool.query("select public.bvs_station_set_segment_status($1::uuid,$2::uuid,'disabled',$3::integer)",[actor,row.id,row.revision]);
   if(!view.control.enabled)await pool.query("select public.bvs_station_set_host($1::uuid,'bvs-main',true,null,$2::integer)",[actor,view.control.revision]);
   await pool.query('commit');console.log(JSON.stringify({activated:true,disabledSamantha:old.length,backup}));
  }catch(e){await pool.query('rollback');throw e;}
 }
} finally {await pool.end();}
