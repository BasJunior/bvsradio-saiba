import { NextResponse } from 'next/server';
import { audit, can, editorialIdentity } from '@/lib/editorial-server';
import { creatorHeaders, creatorUrl, creatorJson } from '@/lib/creator-server';
import { newsletterAllRows, newsletterRows, newsletterMailReady } from '@/lib/newsletter-server';
import { newsletterAudiences, newsletterBody, newsletterDestination, newsletterPath, type NewsletterCampaign } from '@/lib/newsletter';
import { deliverNewsletterBatch } from '@/lib/newsletter-delivery';
export const runtime='nodejs';
export const maxDuration=60;
const uuid=(value:unknown)=>typeof value==='string'&&/^[a-f0-9-]{36}$/.test(value);
async function identityFor(request:Request){const identity=await editorialIdentity(request);return identity&&can(identity,'manage_staff')?identity:null;}
const failure=(error:unknown)=>NextResponse.json({error:error instanceof Error?error.message:'Newsletter service unavailable.'},{status:400});
export async function GET(request:Request){if(!await identityFor(request))return NextResponse.json({error:'Owner or administrator access required.'},{status:403});try{
 const [campaigns,subscribers,deliveries]=await Promise.all([newsletterRows<NewsletterCampaign>('newsletter_campaigns?select=*&order=created_at.desc&limit=100'),newsletterAllRows<{audience:string}>('newsletter_subscribers?is_active=eq.true&select=audience&order=id.asc'),newsletterAllRows<{campaign_id:string;status:string;clicked_at:string|null}>('newsletter_deliveries?select=campaign_id,status,clicked_at&order=id.asc')]);
 return NextResponse.json({campaigns:campaigns.map(c=>({...c,preview:newsletterBody(c,newsletterDestination(c),'https://bvsradio.com/newsletter'),metrics:{queued:deliveries.filter(d=>d.campaign_id===c.id&&d.status==='queued').length,sending:deliveries.filter(d=>d.campaign_id===c.id&&d.status==='sending').length,sent:deliveries.filter(d=>d.campaign_id===c.id&&d.status==='sent').length,suppressed:deliveries.filter(d=>d.campaign_id===c.id&&d.status==='suppressed').length,uncertain:deliveries.filter(d=>d.campaign_id===c.id&&d.status==='uncertain').length,clicked:deliveries.filter(d=>d.campaign_id===c.id&&d.clicked_at).length}})),audience:{all:subscribers.length,...Object.fromEntries(['listener','artist','producer'].map(a=>[a,subscribers.filter(s=>s.audience===a).length]))},mailReady:newsletterMailReady(),countsCapped:subscribers.length===10000||deliveries.length===10000},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return failure(error);}}
export async function POST(request:Request){const identity=await identityFor(request);if(!identity)return NextResponse.json({error:'Owner or administrator access required.'},{status:403});try{const body=await request.json();const action=body.action;
 if(action==='draft'){
 const subject=String(body.subject||'').trim(),copy=String(body.body||'').trim(),cta=String(body.ctaLabel||'').trim();
 if(!subject||subject.length>150||/[\r\n]/.test(subject)||!copy||copy.length>10000||!cta||cta.length>80||!newsletterAudiences.includes(body.audience))throw new Error('Complete the subject, message, audience and button.');
 if(body.campaignId&&!uuid(body.campaignId))throw new Error('Invalid campaign.');
 const rows=await newsletterRows<NewsletterCampaign>(body.campaignId?`newsletter_campaigns?id=eq.${body.campaignId}&status=eq.draft`:'newsletter_campaigns',{method:body.campaignId?'PATCH':'POST',body:JSON.stringify({subject,body:copy,cta_label:cta,cta_path:newsletterPath(String(body.ctaPath||'')),audience:body.audience,updated_at:new Date().toISOString(),...(!body.campaignId?{created_by:identity.user.id}:{})})});
 if(!rows[0])throw new Error('Only unsent drafts can be edited.');
 await audit(identity.user.id,'newsletter_draft','newsletter_campaign',rows[0].id);return NextResponse.json({ok:true});
 }
 if(!uuid(body.campaignId))throw new Error('Choose a campaign.');
 if(!newsletterMailReady())throw new Error('Email sending is not configured. Drafts and previews remain available.');
 if(action==='start'){
 if(body.confirmed!==true||!Number.isInteger(body.reviewedCount)||body.reviewedCount<1||body.reviewedCount>10000)throw new Error('Review the campaign preview and recipient count first.');
 await creatorJson(await fetch(creatorUrl('rpc/queue_newsletter_campaign'),{method:'POST',headers:creatorHeaders,body:JSON.stringify({campaign:body.campaignId,revision:body.revision,reviewed_count:body.reviewedCount})}));
 await audit(identity.user.id,'newsletter_queued','newsletter_campaign',body.campaignId,{recipients:body.reviewedCount});return NextResponse.json({ok:true,message:'Campaign queued. Automatic delivery will begin within one minute.'});
 }
 if(action!=='batch')throw new Error('Unknown newsletter action.');
 const {sent,suppressed,uncertain}=await deliverNewsletterBatch(body.campaignId);
 await audit(identity.user.id,'newsletter_batch','newsletter_campaign',body.campaignId,{sent,suppressed,uncertain});return NextResponse.json({ok:true,message:`${sent} sent, ${suppressed} suppressed, ${uncertain} uncertain. Unconfirmed deliveries are never automatically retried.`});
 }catch(error){return failure(error);}}
