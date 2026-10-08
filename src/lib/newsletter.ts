export const newsletterAudiences = ['all', 'listener', 'artist', 'producer'] as const;
export type NewsletterAudience = typeof newsletterAudiences[number];
export type NewsletterCampaign = { id: string; subject: string; body: string; cta_label: string; cta_path: string; audience: NewsletterAudience; status: string; updated_at: string };
export const escapeEmail = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
export function newsletterPath(value: string) {
  if (!value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) throw new Error('Choose a BVS page path.');
  const url = new URL(value, 'https://bvsradio.com');
  if (url.origin !== 'https://bvsradio.com' || !['/radio','/search','/catalogue','/music','/song','/beat','/release','/creator/studio','/start','/library','/shows'].some(path => url.pathname === path || url.pathname.startsWith(`${path}/`))) throw new Error('Choose a listening or Studio page.');
  return `${url.pathname}${url.search}${url.hash}`;
}
export function newsletterDestination(campaign: NewsletterCampaign) {
  const url = new URL(newsletterPath(campaign.cta_path), 'https://bvsradio.com');
  url.searchParams.set('utm_source', 'bvs_newsletter');
  url.searchParams.set('utm_medium', 'email');
  url.searchParams.set('utm_campaign', campaign.id);
  return url.toString();
}
export function newsletterBody(campaign: NewsletterCampaign, clickUrl: string, unsubscribeUrl: string) {
  return `${campaign.body.split(/\n\s*\n/).map(p => `<p style="line-height:1.6">${escapeEmail(p).replaceAll('\n','<br/>')}</p>`).join('')}<p><a style="color:#c7f340" href="${escapeEmail(clickUrl)}">${escapeEmail(campaign.cta_label)}</a></p><p style="font-size:12px;color:#aaa">You opted in to BVS Radio emails. <a href="${escapeEmail(unsubscribeUrl)}">Unsubscribe</a></p>`;
}
