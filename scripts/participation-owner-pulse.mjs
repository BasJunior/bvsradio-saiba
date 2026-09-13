#!/usr/bin/env node
// VPS-only owner report. Dry-run by default. Never installs a scheduler.
import { readFile, mkdir, open, writeFile, rename } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function localDate(date, zone) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date).map(x => [x.type,x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export function midnight(date, zone) {
  const target = Date.parse(`${date}T00:00:00Z`);
  let guess = target;
  for (let i=0;i<5;i++) {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: zone, year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23' }).formatToParts(new Date(guess)).map(x=>[x.type,x.value]));
    const wall = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
    guess += target-wall;
  }
  return new Date(guess).toISOString();
}
export function windowFor(now = new Date(), zone = 'Europe/Berlin') {
  const today = localDate(now,zone);
  const previous = new Date(Date.parse(today+'T12:00:00Z')-86400000).toISOString().slice(0,10);
  return { localDate: previous, start:midnight(previous,zone), end:midnight(today,zone), zone };
}
export function formatReport(day, counts) {
  return `🦅 BVS daily pulse · ${day}\n${counts.posts} posts · ${counts.replies} replies · ${counts.contributors} external contributors · ${counts.releases} published releases\n${counts.unanswered} unanswered conversations · ${counts.collaborations} collaboration requests awaiting a reply\n${counts.submissions} submissions awaiting review · ${counts.reports} open reports · ${counts.failures} delivery failures\n${counts.posts + counts.replies === 0 ? 'A quiet community day. Invite one artist to share what they are making.' : counts.unanswered ? 'Next: welcome a creator and answer an unanswered conversation.' : 'Next: thank a contributor and highlight a release.'}\nReview: https://bvsradio.com/admin/participation\nFeed: https://bvsradio.com/feed`;
}
async function main() {
  const send = process.argv.includes('--send');
  const zone = process.env.BVS_OWNER_PULSE_TIMEZONE || 'Europe/Berlin';
  const now = new Date();
  const scheduled = process.env.BVS_OWNER_PULSE_TIME || '09:00';
  const clock = new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);
  if (send && clock < scheduled) { console.log('Owner pulse not due.'); return; }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Production Supabase URL and service credential must be supplied through the environment.');
  const rows = async (query) => {
    const out=[];
    for (let offset=0;;offset+=500) {
      const response = await fetch(`${url}/rest/v1/${query}&limit=500&offset=${offset}`,{headers:{apikey:key,Authorization:`Bearer ${key}`}, signal:AbortSignal.timeout(15000)});
      if (!response.ok) throw new Error(`Owner pulse source query failed (${response.status}); no report sent.`);
      const batch=await response.json(); out.push(...batch); if(batch.length<500) return out;
    }
  };
  const w=windowFor(now,zone), range=`created_at=gte.${w.start}&created_at=lt.${w.end}`;
  const [messages,threads,releases,submissions,reports,failures,staff] = await Promise.all([
    rows(`participation_messages?status=eq.published&${range}&select=id,thread_id,author_user_id,message_kind&order=id`),
    rows('participation_threads?status=in.(published,locked)&select=id,author_user_id,intent,created_at&order=id'),
    rows(`releases?published_at=gte.${w.start}&published_at=lt.${w.end}&select=id&order=id`),
    rows('releases?editorial_status=in.(submitted,in_review)&select=id&order=id'),
    rows('participation_reports?status=in.(open,reviewing)&select=id&order=id'),
    rows('participation_deliveries?status=in.(failed,ambiguous,dead_letter)&select=id&order=id'),
    rows('editorial_staff?active=eq.true&select=user_id&order=user_id'),
  ]);
  const excluded = new Set([...staff.map(x=>x.user_id), ...(process.env.BVS_OWNER_PULSE_EXCLUDE_USER_IDS||'').split(',').filter(Boolean)]);
  const visibleThreads=new Set(threads.filter(x=>!excluded.has(x.author_user_id)).map(x=>x.id));
  const activity=messages.filter(x=>visibleThreads.has(x.thread_id)&&!excluded.has(x.author_user_id));
  const allReplies=await rows('participation_messages?status=eq.published&message_kind=eq.reply&select=thread_id&order=id');
  const replied=new Set(allReplies.map(x=>x.thread_id));
  const unanswered=threads.filter(x=>visibleThreads.has(x.id)&&!replied.has(x.id));
  const counts={posts:activity.filter(x=>x.message_kind==='root').length,replies:activity.filter(x=>x.message_kind==='reply').length,contributors:new Set(activity.map(x=>x.author_user_id)).size,releases:releases.length,unanswered:unanswered.length,collaborations:unanswered.filter(x=>x.intent==='collaboration').length,submissions:submissions.length,reports:reports.length,failures:failures.length};
  const report=formatReport(w.localDate,counts);
  if(!send){console.log(report);console.log(JSON.stringify({dryRun:true,...w,scheduled}));return;}
  const dir=join(homedir(),'.openclaw','state','bvs-owner-pulse'); await mkdir(dir,{recursive:true,mode:0o700});
  const file=join(dir,`${w.localDate}.json`);
  let handle;
  try{handle=await open(file,'wx',0o600);}catch(error){if(error.code==='EEXIST'){console.log('Daily run already recorded; reconcile failed or ambiguous delivery before retry.');return;}throw error;}
  await handle.writeFile(JSON.stringify({state:'processing',window:w,counts,startedAt:now.toISOString()}));await handle.close();
  // The established helper selects only Abias's allowlisted target from notify.json.
  const result=spawnSync(join(homedir(),'.grok','bin','telegram-notify'),[report],{encoding:'utf8',timeout:45000});
  let receipt=null;
  try{const parsed=JSON.parse(result.stdout||'{}');receipt=parsed.messageId||parsed.result?.messageId||parsed.payload?.messageId||null;}catch{}
  const state=result.status===0?'sent':'ambiguous';
  const tmp=file+'.tmp';await writeFile(tmp,JSON.stringify({state,window:w,counts,receipt:receipt|| (state==='sent'?'helper-exit-0':null),finishedAt:new Date().toISOString()}),{mode:0o600});await rename(tmp,file);
  console.log(JSON.stringify({state,localDate:w.localDate,receipt:receipt||null}));
  if(state!=='sent')process.exitCode=1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error=>{console.error(error.message);process.exitCode=1;});
