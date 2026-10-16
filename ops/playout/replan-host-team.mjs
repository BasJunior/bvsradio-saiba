#!/usr/bin/env node
// Replace only the unplayed music-only queue at rollout; preserve the on-air song.
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {planExtension} from '../../src/lib/station-host.mjs';
const env=Object.fromEntries(readFileSync('/home/admin/.openclaw/secrets/bvs-supabase-db.env','utf8').split('\n').flatMap(l=>{const m=l.match(/^([A-Z0-9_]+)=(.*)$/);return m?[[m[1],m[2].trim().replace(/^['"]|['"]$/g,'')]]:[]}));
const {Pool}=createRequire('/opt/bvsradio/package.json')('pg');
const pool=new Pool({connectionString:env.DATABASE_URL,ssl:{rejectUnauthorized:false},max:1});
try {
 await pool.query('begin');
 await pool.query("select id from station_playout_items where programme_id='bvs-main' and status in ('on_air','scheduled') for update");
 await pool.query("select programme_id from station_host_settings where programme_id='bvs-main' for update");
 let view=(await pool.query("select public.bvs_station_engine_view('bvs-main') as payload")).rows[0].payload;
 if(!view.onAir||view.onAir.kind!=='music'||view.scheduled.some(i=>i.kind!=='music'))throw new Error('Only a music-only queue behind an on-air song may be refreshed');
 const end=new Date(Date.parse(view.onAir.startedAt)+view.onAir.durationSeconds*1000);
 if(end.getTime()<Date.now()+5000)throw new Error('Too close to song end; retry at the next song');
 const oldIds=view.scheduled.map(i=>i.id);
 const currentId=view.onAir.trackId;
 await pool.query("update station_playout_items set status='skipped',skip_reason='host_team_rollout',ended_at=clock_timestamp() where programme_id='bvs-main' and status='scheduled' and id=any($1::uuid[])",[oldIds]);
 view=(await pool.query("select public.bvs_station_engine_view('bvs-main') as payload")).rows[0].payload;
 const next=view.rotation.findIndex(t=>t.id===currentId)+1;
 const rotation=[...view.rotation.slice(next),...view.rotation.slice(0,next)];
 const items=planExtension({rotation,segments:view.segments,pronunciations:view.pronunciations,musicSinceVoice:view.musicSinceVoice,voiceSlotIndex:view.voiceSlotIndex,nextPosition:view.nextPosition,settings:view.control,usedSegmentIds:view.usedSegmentIds,horizon:8,now:end});
 if(!items.some(i=>i.kind==='ai_voice'))throw new Error('No fresh team voice fits this queue');
 console.log(JSON.stringify({apply:process.argv.includes('--apply'),preservedCurrent:view.onAir.title,startsAfter:end,items:items.map(i=>({kind:i.kind,title:i.title,segmentId:i.segmentId}))}));
 if(process.argv.includes('--apply')){await pool.query("select public.bvs_station_plan_items('bvs-main',$1::jsonb)",[JSON.stringify(items)]);await pool.query('commit');console.log('Queue refreshed; original scheduled rows retained as skipped.');}else await pool.query('rollback');
}catch(e){await pool.query('rollback');throw e;}finally{await pool.end();}
