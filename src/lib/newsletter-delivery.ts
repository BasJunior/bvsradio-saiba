import 'server-only';
import { newsletterRows, newsletterToken, newsletterMailReady } from '@/lib/newsletter-server';
import { escapeEmail, newsletterBody, type NewsletterCampaign } from '@/lib/newsletter';
import { sendBvsEmail, wrapBvsEmailHtml } from '@/lib/mailer';

/** Atomic per-delivery claims let cron and manual sends safely share the queue.
 * SMTP outcomes that cannot be confirmed are held for review, never retried.
 */
export async function deliverNewsletterBatch(campaignId: string) {
 if (!newsletterMailReady()) throw new Error('Email sending is not configured.');
 const [campaign]=await newsletterRows<NewsletterCampaign>(`newsletter_campaigns?id=eq.${campaignId}&select=*`);
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
 await newsletterRows(`newsletter_campaigns?id=eq.${campaign.id}`,{method:'PATCH',body:JSON.stringify({...(!pending.length?{status:'sent'}:{}),updated_at:new Date().toISOString()})});
 return {sent,suppressed,uncertain};
}
