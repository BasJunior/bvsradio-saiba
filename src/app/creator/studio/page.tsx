'use client'
import { FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import MyBeatStore from '@/components/MyBeatStore'
import CreatorInsights from '@/components/CreatorInsights'
import StudioPremiumDesk from '@/components/StudioPremiumDesk'
import DistributionPathTimeline from '@/components/DistributionPathTimeline'
import CreatorMarketplaceDesk from '@/app/creator/marketplace/page'
import { buildArtistPathSteps, publicDistributionStatusLabel } from '@/lib/distribution-path'

type WorkflowItem={id:string;title?:string;topic?:string;status?:string;editor_notes?:string;review_notes?:string;scheduled_for?:string}; type ShowItem=WorkflowItem & {status:string}; type Release={id:string;title:string;genre?:string;editorial_status:string;editorial_notes?:string;is_public:boolean;in_rotation:boolean;is_downloadable:boolean;download_price:number;licence_type:string;play_count:number;like_count?:number;created_at:string;release_id?:string;isrc?:string;spotify_url?:string}; type AlbumRelease={id:string;title:string;artist_name?:string;genre?:string;editorial_status:string;editorial_notes?:string;is_public:boolean;in_rotation:boolean;release_type?:string;track_count?:number;created_at:string;published_at?:string|null}; type DistJob={id:string;release_id:string;status:string;notes?:string|null;updated_at?:string;created_at?:string}; type TrackRequest={id:string;track_id:string;request_type:string;status:string;message:string;created_at:string}; type ProfileFlags={premiumActive:boolean;premiumUntil:string|null;distributionEnabled:boolean;premiumPlanId?:string|null}; type Data = { profile:{role:string;display_name?:string;is_producer?:boolean}; application?:{status:string;review_notes?:string}; articles:WorkflowItem[]; briefs:WorkflowItem[]; shows:ShowItem[]; episodes:WorkflowItem[]; tracks:Release[]; trackRequests:TrackRequest[]; releases?:AlbumRelease[]; distributionJobs?:DistJob[]; profileFlags?:ProfileFlags }
const field = 'w-full rounded-xl border border-white/10 bg-black/20 p-3 outline-none focus:border-brand'

export default function CreatorStudio() {
  const [data,setData]=useState<Data|null>(null), [token,setToken]=useState(''), [error,setError]=useState(''), [message,setMessage]=useState('')
  const load=useCallback(async(t:string)=>{const r=await fetch('/api/creator/workspace',{headers:{Authorization:`Bearer ${t}`},cache:'no-store'});const p=await r.json();if(!r.ok)throw new Error(p.error);setData(p)},[])
  useEffect(()=>{if(!isSupabaseConfigured())return;createClient().auth.getSession().then(({data:s})=>{const t=s.session?.access_token;if(!t){setError('Sign in with a creator account.');return}setToken(t);load(t).catch(e=>setError(e.message))})},[load])
  const act=async(body:Record<string,unknown>)=>{setError('');setMessage('');const r=await fetch('/api/creator/workspace',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(body)});const p=await r.json();if(!r.ok){setError(p.error);return}setMessage('Saved successfully.');await load(token)}
  if(error&&!data)return <main className="mx-auto min-h-[65vh] max-w-2xl px-6 py-20 text-center"><h1 className="text-3xl">Creator workspace unavailable</h1><p className="mt-4 text-text-secondary">{error}</p><Link href="/auth/login" className="mt-6 inline-block rounded-full bg-brand px-6 py-3 font-semibold text-black">Sign in</Link></main>
  if(!data)return <main className="p-20 text-center text-text-secondary">Loading creator workspace…</main>
  const artist=['artist','admin'].includes(data.profile.role), writer=['writer','admin'].includes(data.profile.role), showCreator=['show_creator','admin'].includes(data.profile.role)
  const producer = Boolean((data.profile as {is_producer?: boolean}).is_producer) || data.profile.role === 'admin'
  return <main className="mx-auto max-w-6xl px-6 py-12"><p className="text-xs uppercase tracking-[.22em] text-brand">Creator studio</p><h1 className="mt-2 text-4xl font-semibold">Welcome, {data.profile.display_name||'creator'}</h1><p className="mt-3 text-text-secondary">Draft privately, submit when ready, and follow the human editorial review. Premium members get multi-platform distribution after BVS publish.</p>{error&&<p className="mt-5 rounded-xl bg-red-500/10 p-4 text-red-200">{error}</p>}{message&&<p className="mt-5 rounded-xl bg-brand/10 p-4 text-brand">{message}</p>}
    {artist&&<div id="release-path"><CreatorDropDown label="Release path"><ArtistPathBoard data={data} /></CreatorDropDown></div>}
    <div id="premium-desk"><CreatorDropDown label="Premium desk"><StudioPremiumDesk token={token}/></CreatorDropDown></div>
    <div id="marketplace-desk"><CreatorDropDown label="Marketplace"><CreatorMarketplaceDesk accessToken={token} embedded /></CreatorDropDown></div>
    {(artist||producer)&&<CreatorDropDown label="Performance and editorial insights" defaultOpen><CreatorInsights token={token}/></CreatorDropDown>}
    {producer&&<div id="beatstore"><CreatorDropDown label="My BeatStore"><MyBeatStore/></CreatorDropDown></div>}
    {artist&&<CreatorDropDown label="Releases and artist requests" count={(data.tracks||[]).length} defaultOpen><ArtistReleases tracks={data.tracks||[]} requests={data.trackRequests||[]} jobs={data.distributionJobs||[]} releases={data.releases||[]} flags={data.profileFlags} act={act}/></CreatorDropDown>}
    {writer&&<>
      <CreatorDropDown label="Writer application" defaultOpen={!data.application||['submitted','information_requested'].includes(data.application.status)}><WriterApplication application={data.application} act={act}/></CreatorDropDown>
      {(data.profile.role==='admin'||data.application?.status==='approved')&&<CreatorDropDown label="Create a new article"><ArticleForm act={act}/></CreatorDropDown>}
      <CreatorDropDown label="Your articles" count={data.articles.length} defaultOpen={data.articles.some(item=>['submitted','in_review','changes_requested'].includes(item.status||''))}><Queue title="Your articles" items={data.articles}/></CreatorDropDown>
      <CreatorDropDown label="Assigned research briefs" count={data.briefs.length}><Queue title="Assigned research briefs" items={data.briefs} note="Briefs provide sourced direction only. A human editor must approve them before drafting, and articles still require separate review."/></CreatorDropDown>
    </>}
    {showCreator&&<>
      <CreatorDropDown label="Propose a weekly show"><ShowForm act={act}/></CreatorDropDown>
      <CreatorDropDown label="Submit a weekly episode" defaultOpen={data.shows.some(show=>show.status==='approved')}><EpisodeForm shows={data.shows} token={token} act={act}/></CreatorDropDown>
      <CreatorDropDown label="Your shows" count={data.shows.length} defaultOpen={data.shows.some(item=>['submitted','in_review','changes_requested'].includes(item.status||''))}><Queue title="Your shows" items={data.shows}/></CreatorDropDown>
      <CreatorDropDown label="Your episodes" count={data.episodes.length} defaultOpen={data.episodes.some(item=>['submitted','in_review','changes_requested'].includes(item.status||''))}><Queue title="Your episodes" items={data.episodes}/></CreatorDropDown>
    </>}
  </main>
}

function CreatorDropDown({label,count,defaultOpen=false,children}:{label:string;count?:number;defaultOpen?:boolean;children:ReactNode}){
  const[open,setOpen]=useState(defaultOpen)
  const panelId=`creator-${label.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`
  return <section className="mt-8 rounded-2xl border border-white/10 bg-white/[.015]">
    <button type="button" aria-expanded={open} aria-controls={panelId} onClick={()=>setOpen(value=>!value)} className="flex w-full items-center justify-between gap-4 rounded-2xl px-5 py-4 text-left transition hover:bg-white/[.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
      <span className="flex min-w-0 items-center gap-3"><span className="font-semibold">{label}</span>{typeof count==='number'&&<span className="rounded-full border border-white/10 px-2.5 py-0.5 text-xs text-text-secondary">{count}</span>}</span>
      <span className="flex shrink-0 items-center gap-2 text-xs text-text-secondary">{open?'Hide section':'Show section'}<svg viewBox="0 0 20 20" aria-hidden="true" className={`h-4 w-4 transition-transform ${open?'rotate-180':''}`} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
    </button>
    {open&&<div id={panelId} className="border-t border-white/10 px-5 pb-6 pt-1">{children}</div>}
  </section>
}
function WriterApplication({application,act}:{application:Data['application'];act:(b:Record<string,unknown>)=>Promise<void>}){const[bio,setBio]=useState(''),[portfolio,setPortfolio]=useState(''),[beats,setBeats]=useState('Music, Culture');if(application)return <section className="mt-10 rounded-2xl border border-white/10 p-6"><h2 className="text-2xl">Writer application</h2><p className="mt-2 text-brand">{application.status.replaceAll('_',' ')}</p>{application.review_notes&&<p className="mt-2 text-sm text-text-secondary">Editor: {application.review_notes}</p>}</section>;return <form onSubmit={e=>{e.preventDefault();void act({action:'apply_writer',bio,portfolioUrl:portfolio,beats:beats.split(',')})}} className="mt-10 space-y-3 rounded-2xl border border-white/10 p-6"><h2 className="text-2xl">Apply to write</h2><textarea required minLength={40} value={bio} onChange={e=>setBio(e.target.value)} placeholder="Experience and what you want to cover" className={field}/><input value={beats} onChange={e=>setBeats(e.target.value)} placeholder="Beats, comma separated" className={field}/><input value={portfolio} onChange={e=>setPortfolio(e.target.value)} placeholder="Portfolio URL (optional)" className={field}/><button className="rounded-full bg-brand px-5 py-2 font-semibold text-black">Submit application</button></form>}
function ArticleForm({act}:{act:(b:Record<string,unknown>)=>Promise<void>}){const[form,set]=useState({title:'',dek:'',body:'',sources:''});const submit=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const submitter=(e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement;void act({action:'save_article',...form,sources:form.sources.split('\n').filter(Boolean),submit:submitter.value==='submit'})};return <form onSubmit={submit} className="mt-10 grid gap-3 rounded-2xl border border-white/10 p-6"><h2 className="text-2xl">New article</h2><input required value={form.title} onChange={e=>set({...form,title:e.target.value})} placeholder="Headline" className={field}/><input value={form.dek} onChange={e=>set({...form,dek:e.target.value})} placeholder="One-line summary" className={field}/><textarea value={form.body} onChange={e=>set({...form,body:e.target.value})} placeholder="Draft" className={`${field} min-h-64`}/><textarea value={form.sources} onChange={e=>set({...form,sources:e.target.value})} placeholder="Source URLs, one per line" className={field}/><div className="flex gap-3"><button value="draft" className="rounded-full border border-white/20 px-5 py-2">Save draft</button><button value="submit" className="rounded-full bg-brand px-5 py-2 font-semibold text-black">Submit for review</button></div></form>}
function ShowForm({act}:{act:(b:Record<string,unknown>)=>Promise<void>}){const[form,set]=useState({title:'',description:'',category:'Music',artworkUrl:''});return <form onSubmit={e=>{e.preventDefault();void act({action:'save_show',...form,submit:true})}} className="mt-10 grid gap-3 rounded-2xl border border-white/10 p-6"><h2 className="text-2xl">Propose a weekly show</h2><input required value={form.title} onChange={e=>set({...form,title:e.target.value})} placeholder="Show title" className={field}/><textarea value={form.description} onChange={e=>set({...form,description:e.target.value})} placeholder="Format, audience and weekly concept" className={field}/><input value={form.category} onChange={e=>set({...form,category:e.target.value})} placeholder="Category" className={field}/><input value={form.artworkUrl} onChange={e=>set({...form,artworkUrl:e.target.value})} placeholder="Artwork URL (optional)" className={field}/><button className="rounded-full bg-brand px-5 py-2 font-semibold text-black">Submit show</button></form>}
function EpisodeForm({shows,token,act}:{shows:ShowItem[];token:string;act:(b:Record<string,unknown>)=>Promise<void>}){const approved=shows.filter(s=>s.status==='approved');const[showId,setShow]=useState(''),[title,setTitle]=useState(''),[description,setDescription]=useState(''),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[uploadProgress,setUploadProgress]=useState('');const submit=async(e:FormEvent)=>{e.preventDefault();if(!file)return;setBusy(true);setUploadProgress('Preparing secure upload…');try{const r=await fetch('/api/creator/episode-upload/prepare',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({name:file.name,type:file.type,size:file.size})});const p=await r.json();if(!r.ok)throw new Error(p.error);setUploadProgress('Uploading directly to secure storage…');const upload=await fetch(p.slot.signedUrl,{method:'PUT',headers:{'Content-Type':p.slot.contentType||file.type||'audio/mpeg'},body:file});if(!upload.ok)throw new Error('Episode upload failed. Check your connection and try again.');setUploadProgress('Submitting for editorial review…');await act({action:'submit_episode',showId,title,description,audioPath:p.slot.path});setFile(null);setUploadProgress('Episode submitted.')}catch(caught){setUploadProgress(caught instanceof Error?caught.message:'Episode upload failed.')}finally{setBusy(false)}};return <form onSubmit={submit} className="mt-10 grid gap-3 rounded-2xl border border-white/10 p-6"><h2 className="text-2xl">Submit a weekly episode</h2><p className="text-sm text-text-secondary">Audio uploads directly to secure BVS storage, so large episodes do not pass through the website server.</p>{!approved.length&&<p className="text-sm text-amber-200">Your show must be approved before episodes can be submitted.</p>}<select required value={showId} onChange={e=>setShow(e.target.value)} className={field}><option value="">Approved show</option>{approved.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select><input required value={title} onChange={e=>setTitle(e.target.value)} placeholder="Episode title" className={field}/><textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Episode notes and guest details" className={field}/><input required type="file" accept="audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/flac,audio/aac,.mp3,.m4a,.wav,.ogg,.flac,.aac" onChange={e=>setFile(e.target.files?.[0]||null)} className={field}/>{uploadProgress&&<p className="text-sm text-text-secondary" role="status">{uploadProgress}</p>}<button disabled={busy||!approved.length} className="rounded-full bg-brand px-5 py-2 font-semibold text-black disabled:opacity-40">{busy?'Uploading…':'Upload and submit'}</button></form>}
function ArtistPathBoard({data}:{data:Data}){
  const flags=data.profileFlags||{premiumActive:false,premiumUntil:null,distributionEnabled:false}
  const releases=data.releases||[]
  const jobs=data.distributionJobs||[]
  const tracks=data.tracks||[]
  const focus=useMemo(()=>{
    const release=releases[0]
    const track=tracks[0]
    const job=release?jobs.find(j=>j.release_id===release.id):undefined
    return {release,track,job}
  },[releases,tracks,jobs])
  const steps=buildArtistPathSteps({
    premiumActive:flags.premiumActive,
    distributionEnabled:flags.distributionEnabled,
    hasSubmission:Boolean(focus.release||focus.track),
    bvsStatus:focus.release?.editorial_status||focus.track?.editorial_status,
    isPublic:Boolean(focus.release?.is_public||focus.track?.is_public),
    inRotation:Boolean(focus.release?.in_rotation||focus.track?.in_rotation),
    distroStatus:focus.job?.status,
  })
  return <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
    <DistributionPathTimeline steps={steps} />
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-brand">User story</p>
      <h2 className="mt-2 text-xl font-semibold">Premium song → BVS → platforms</h2>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-text-secondary">
        <li>Activate <Link href="/artist/premium" className="text-brand hover:underline">Artist Premium</Link> (unlocks multi-platform).</li>
        <li><Link href="/upload" className="text-brand hover:underline">Submit</Link> single/EP/album with rights confirmed.</li>
        <li>BVS editorial approves → live on BVS Radio / catalogue (rotation optional).</li>
        <li>If Premium: release enters multi-platform queue automatically.</li>
        <li>BVS ops hand off to the private distribution partner.</li>
        <li>After partner/store approval → live on Spotify and other major platforms.</li>
      </ol>
      <div className="mt-5 rounded-xl border border-white/10 p-3 text-xs text-text-secondary">
        <p><span className="text-text-primary">Premium:</span> {flags.premiumActive?'active':'off'}{flags.distributionEnabled?' · distribution on':' · distribution off'}</p>
        <p className="mt-1"><span className="text-text-primary">Focus release:</span> {focus.release?.title||focus.track?.title||'None yet'}</p>
        <p className="mt-1"><span className="text-text-primary">Platforms:</span> {publicDistributionStatusLabel(focus.job?.status)}</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/upload" className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-black">Submit music</Link>
        <Link href="/artist/premium" className="rounded-full border border-white/20 px-4 py-2 text-sm hover:border-brand">Premium</Link>
      </div>
    </div>
  </div>
}

function ArtistReleases({tracks,requests,jobs,releases,flags,act}:{tracks:Release[];requests:TrackRequest[];jobs:DistJob[];releases:AlbumRelease[];flags?:ProfileFlags;act:(b:Record<string,unknown>)=>Promise<void>}){
  const[trackId,setTrack]=useState(''),[requestType,setType]=useState('takedown'),[message,setMessage]=useState('')
  const submit=(e:FormEvent)=>{e.preventDefault();void act({action:'track_request',trackId,requestType,message})}
  const jobByRelease=new Map(jobs.map(j=>[j.release_id,j]))
  return <section className="mt-10">
    <div className="grid gap-3 sm:grid-cols-5">{[
      ['Uploads',tracks.length],
      ['Published',tracks.filter(t=>t.is_public).length],
      ['In rotation',tracks.filter(t=>t.in_rotation).length],
      ['Album releases',releases.length],
      ['Total plays',tracks.reduce((sum,t)=>sum+Number(t.play_count||0),0)],
    ].map(([label,value])=><div key={String(label)} className="rounded-xl border border-white/10 p-4"><p className="text-xs text-text-secondary">{label}</p><p className="mt-1 text-2xl text-brand">{value}</p></div>)}</div>
    {releases.length>0&&(
      <div className="mt-8">
        <h2 className="text-2xl">Album / EP path</h2>
        <div className="mt-4 space-y-3">{releases.map(release=>{
          const job=jobByRelease.get(release.id)
          return <article key={release.id} className="rounded-xl border border-white/10 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-medium">{release.title}</h3>
                <p className="mt-1 text-xs capitalize text-text-secondary">{release.release_type||'release'} · {release.editorial_status.replaceAll('_',' ')} · {release.is_public?'on BVS':'not public'} · {release.in_rotation?'in rotation':'not in rotation'}</p>
              </div>
              <p className="max-w-xs text-right text-xs text-brand">{publicDistributionStatusLabel(job?.status)}</p>
            </div>
            {release.editorial_notes&&<p className="mt-3 text-sm text-text-secondary">Editor: {release.editorial_notes}</p>}
            {!(flags?.premiumActive&&flags?.distributionEnabled)&&release.is_public&&(
              <p className="mt-3 text-xs text-amber-100">Live on BVS. Multi-platform needs active Artist Premium.</p>
            )}
          </article>
        })}</div>
      </div>
    )}
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div>
        <h2 className="text-2xl">Your tracks</h2>
        <div className="mt-4 space-y-3">{tracks.map(track=><article key={track.id} className="rounded-xl border border-white/10 p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="font-medium">{track.title}</h3>
              <p className="mt-1 text-xs capitalize text-text-secondary">{track.genre||'Music'} · {track.editorial_status.replaceAll('_',' ')} · {track.is_public?'published':'not public'} · {track.in_rotation?'in rotation':'not in rotation'}</p>
              {(track.isrc||track.spotify_url)&&(
                <p className="mt-2 text-xs text-text-secondary">{track.isrc?`ISRC ${track.isrc}`:''}{track.isrc&&track.spotify_url?' · ':''}{track.spotify_url?'Linked on Spotify':''}</p>
              )}
            </div>
            <div className="text-right text-xs text-text-secondary"><p className="text-lg text-brand">{Number(track.play_count||0)}</p><p>plays</p></div>
          </div>
          {track.editorial_notes&&<p className="mt-3 text-sm text-text-secondary">Editor: {track.editorial_notes}</p>}
          <p className="mt-3 text-xs text-text-secondary">{track.is_downloadable?`${track.licence_type.replaceAll('_',' ')} · $${Number(track.download_price||0).toFixed(2)}`:'Not available for download sale'}</p>
        </article>)}{!tracks.length&&<p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-text-secondary">Your uploaded tracks and review status will appear here after submission.</p>}</div>
      </div>
      <form onSubmit={submit} className="rounded-xl border border-white/10 p-4">
        <h2 className="text-xl">Request a change</h2>
        <p className="mt-1 text-sm text-text-secondary">Ask editorial for takedown, metadata, artwork, rights or payout help.</p>
        <select required value={trackId} onChange={e=>setTrack(e.target.value)} className={`${field} mt-4`}><option value="">Select release</option>{tracks.map(track=><option key={track.id} value={track.id}>{track.title}</option>)}</select>
        <select value={requestType} onChange={e=>setType(e.target.value)} className={`${field} mt-3`}><option value="takedown">Takedown / unpublish</option><option value="metadata_correction">Metadata correction</option><option value="artwork_replacement">Artwork replacement</option><option value="rights_update">Rights update</option><option value="payout_question">Payout question</option><option value="other">Other</option></select>
        <textarea required minLength={10} value={message} onChange={e=>setMessage(e.target.value)} placeholder="What should the team change or review?" className={`${field} mt-3 min-h-28`}/>
        <button disabled={!tracks.length} className="mt-3 rounded-full bg-brand px-5 py-2 font-semibold text-black disabled:opacity-40">Send request</button>
        <div className="mt-5 space-y-2">{requests.slice(0,5).map(item=><p key={item.id} className="rounded-lg border border-white/10 p-3 text-xs text-text-secondary">{item.request_type.replaceAll('_',' ')} · {item.status} · {new Date(item.created_at).toLocaleDateString()}</p>)}</div>
      </form>
    </div>
  </section>
}
function Queue({title,items,note}:{title:string;items:WorkflowItem[];note?:string}){return <section className="mt-10"><h2 className="text-2xl">{title}</h2>{note&&<p className="mt-2 max-w-3xl text-sm text-text-secondary">{note}</p>}<div className="mt-4 space-y-3">{items.map(item=><article key={item.id} className="rounded-xl border border-white/10 p-4"><div className="flex justify-between gap-4"><h3 className="font-medium">{item.title||item.topic}</h3><span className="text-xs uppercase text-brand">{item.status?.replaceAll('_',' ')}</span></div>{(item.editor_notes||item.review_notes)&&<p className="mt-2 text-sm text-text-secondary">Editor: {item.editor_notes||item.review_notes}</p>}{item.scheduled_for&&<p className="mt-2 text-xs text-text-secondary">Scheduled {new Date(item.scheduled_for).toLocaleString()}</p>}</article>)}{!items.length&&<p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-text-secondary">Nothing here yet.</p>}</div></section>}
