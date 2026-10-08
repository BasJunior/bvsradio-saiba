import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { creatorHeaders, creatorUrl, creatorJson } from '@/lib/creator-server';
export async function newsletterRows<T>(path: string, init: RequestInit = {}): Promise<T[]> {
  return creatorJson(await fetch(creatorUrl(path), { ...init, headers: { ...creatorHeaders, Prefer: 'return=representation', ...init.headers }, cache: 'no-store' }));
}
export async function newsletterAllRows<T>(path: string): Promise<T[]> {
  const rows:T[]=[];
  for(let offset=0;offset<10000;offset+=1000){
    const page=await newsletterRows<T>(`${path}&limit=1000&offset=${offset}`);
    rows.push(...page);
    if(page.length<1000)break;
  }
  return rows;
}
export function newsletterToken(id: string) {
  const secret = process.env.NEWSLETTER_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('Newsletter token service unavailable.');
  return createHmac('sha256', secret).update(`bvs-newsletter-v1:${id}`).digest('hex');
}
export function validNewsletterToken(id: string, token: string) {
  if (!/^[a-f0-9-]{36}$/.test(id) || !/^[a-f0-9]{64}$/.test(token)) return false;
  const expected = Buffer.from(newsletterToken(id));
  return timingSafeEqual(expected, Buffer.from(token));
}
export const newsletterMailReady = () => Boolean((process.env.SMTP_USER || process.env.BVS_ORDER_EMAIL) && process.env.SMTP_PASS);
