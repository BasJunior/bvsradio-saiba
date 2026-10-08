import { NextResponse } from 'next/server';
import { audit, can, editorialIdentity } from '@/lib/editorial-server';
import { creatorHeaders, creatorUrl, creatorJson } from '@/lib/creator-server';
import { newsletterAllRows, newsletterRows, newsletterToken, newsletterMailReady } from '@/lib/newsletter-server';
import { escapeEmail, newsletterAudiences, newsletterBody, newsletterDestination, newsletterPath, type NewsletterCampaign } from '@/lib/newsletter';
import { sendBvsEmail, wrapBvsEmailHtml } from '@/lib/mailer';
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
 await audit(identity.user.id,'newsletter_queued','newsletter_campaign',body.campaignId,{recipients:body.reviewedCount});return NextResponse.json({ok:true,message:'Campaign queued. Use Send next batch to deliver it.'});
 }
 if(action!=='batch')throw new Error('Unknown newsletter action.');
 const [campaign]=await newsletterRows<NewsletterCampaign>(`newsletter_campaigns?id=eq.${body.campaignId}&select=*`);
 if(!campaign||campaign.status!=='sending')throw new Error('Campaign is not queued for sending.');
 const queued=await newsletterRows<{id:string;subscriber_id:string}>(`newsletter_deliveries?campaign_id=eq.${campaign.id}&status=eq.queued&select=id,subscriber_id&order=created_at.asc&limit=3`);
 let sent=0,suppressed=0,uncertain=0;
 for(const delivery of queued){
 const claimed=await newsletterRows(`newsletter_deliveries?id=eq.${delivery.id}&status=eq.queued`,{method:'PATCH',body:JSON.stringify({status:'sending'})});if(!claimed.length)continue;
 const [subscriber]=await newsletterRows<{email:string;is_active:boolean;audience:string}>(`newsletter_subscribers?id=eq.${delivery.subscriber_id}&select=email,is_active,audience`);
 if(!subscriber?.is_active||(campaign.audience!=='all'&&subscriber.audience!==campaign.audience)){await newsletterRows(`newsletter_deliveries?id=eq.${delivery.id}`,{method:'PATCH',body:JSON.stringify({status:'suppressed'})});suppressed++;continue;}
 const unsub=`https://bvsradio.com/newsletter/unsubscribe?id=${delivery.subscriber_id}&token=${newsletterToken(delivery.subscriber_id)}`;
 const click=`https://bvsradio.com/newsletter/click?id=${delivery.id}&token=${newsletterToken(delivery.id)}`;
 try{await sendBvsEmail({to:subscriber.email,subject:campaign.subject,unsubscribeUrl:unsub,timeoutMs:5000,text:`${campaign.body}\n\n${campaign.cta_label}: ${click}\n\nUnsubscribe: ${unsub}`,html:wrapBvsEmailHtml({title:escapeEmail(campaign.subject),bodyHtml:newsletterBody(campaign,click,unsub)})});await newsletterRows(`newsletter_deliveries?id=eq.${delivery.id}`,{method:'PATCH',body:JSON.stringify({status:'sent',sent_at:new Date().toISOString()})});sent++;}
 catch{await newsletterRows(`newsletter_deliveries?id=eq.${delivery.id}`,{method:'PATCH',body:JSON.stringify({status:'uncertain',error:'Delivery could not be confirmed. Check provider logs before retrying.'})});uncertain++;}
 }
 const pending=await newsletterRows(`newsletter_deliveries?campaign_id=eq.${campaign.id}&status=in.(queued,sending)&select=id&limit=1`);
 if(!pending.length)await newsletterRows(`newsletter_campaigns?id=eq.${campaign.id}`,{method:'PATCH',body:JSON.stringify({status:'sent',updated_at:new Date().toISOString()})});
 await audit(identity.user.id,'newsletter_batch','newsletter_campaign',campaign.id,{sent,suppressed,uncertain});return NextResponse.json({ok:true,message:`${sent} sent, ${suppressed} suppressed, ${uncertain} uncertain. Unconfirmed deliveries are never automatically retried.`});
 }catch(error){return failure(error);}}
