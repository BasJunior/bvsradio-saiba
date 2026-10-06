'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAccountJson } from '@/lib/use-account-json';
import { creatorGrowth, promotionCaption, type GrowthMetrics, type GrowthRole, type PromotionItem } from '@/lib/creator-growth';
import { canonicalBvsShareUrl } from '@/lib/share-url';
import AppShareButton from '@/components/app-vnext/AppShareButton';

type Data = ReturnType<typeof creatorGrowth> & {
  role: GrowthRole; canProduce: boolean; canMakeMusic: boolean; metrics: GrowthMetrics; items: PromotionItem[];
  badges: Array<{ badge_id: string; earned_at: string }>;
  results: Array<{ id: string; kind: string; itemId: string; visits: number; plays: number; saves: number }>;
};
const badgeNames: Record<string, string> = { first_release: 'First Release', beat_maker: 'Beat Maker', on_air: 'On Air', first_audience: 'First Audience', first_100: 'First 100', first_sale: 'First Sale', launch: 'Launch', momentum: 'Momentum', breakthrough: 'Breakthrough' };

export default function CreatorGrowthPanel({ owner, token, surface }: { owner: string; token: string; surface?: 'ios' | 'android' }) {
  const [selection, setSelection] = useState<{ owner: string; role: GrowthRole } | null>(null);
  const role = selection?.owner === owner ? selection.role : '';
  const setRole = (next: GrowthRole) => setSelection({ owner, role: next });
  const { data, error, loading, reload } = useAccountJson<Data>({ owner, token, url: `/api/creator/growth${role ? `?role=${role}` : ''}`, errorMessage: 'Could not load your goals.' });
  const [notice, setNotice] = useState<{ owner: string; text: string } | null>(null);
  useEffect(() => {
    if (!data?.badges.length) return;
    const timer = window.setTimeout(() => { try {
      const key = `bvs.achievements.seen.${owner}`;
      const seen = new Set(JSON.parse(localStorage.getItem(key) || '[]') as string[]);
      const fresh = data.badges.filter(badge => !seen.has(badge.badge_id));
      if (fresh.length) setNotice({ owner, text: `You earned ${fresh.map(b => badgeNames[b.badge_id] || b.badge_id).join(', ')}.` });
      localStorage.setItem(key, JSON.stringify(data.badges.map(b => b.badge_id)));
    } catch { /* Recognition remains available when local storage is disabled. */ } }, 0);
    return () => window.clearTimeout(timer);
  }, [data, owner]);
  const base = surface ? `/app/${surface}/studio` : '/creator/studio';
  const items = data?.items.filter(item => item.kind === (data.role === 'producer' ? 'beat' : data.role === 'show_creator' ? 'episode' : 'track')) || [];
  return <section id="grow" aria-label="Grow with BVS" className="mt-8 rounded-3xl border border-white/10 bg-white/[.025] p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-brand">Grow with BVS</p><h2 className="mt-2 text-3xl font-semibold">{data?.current?.name || (data ? 'Your next chapter' : 'Your next goal')}</h2></div>
      <div className="flex flex-wrap gap-2">{data?.canProduce && data.canMakeMusic ? <><button type="button" aria-pressed={data.role === 'artist'} onClick={() => setRole('artist')} className={`min-h-11 rounded-full border px-4 text-sm ${data.role === 'artist' ? 'border-brand/40 bg-brand/10 text-brand' : 'border-white/15'}`}>Artist goals</button><button type="button" aria-pressed={data.role === 'producer'} onClick={() => setRole('producer')} className={`min-h-11 rounded-full border px-4 text-sm ${data.role === 'producer' ? 'border-brand/40 bg-brand/10 text-brand' : 'border-white/15'}`}>Producer goals</button></> : null}<button type="button" onClick={reload} className="min-h-11 rounded-full border border-white/15 px-4 text-sm">Refresh</button></div>
    </div>
    {loading ? <p className="mt-4 text-sm text-text-secondary">Checking your progress…</p> : null}
    {error ? <p role="alert" className="mt-4 text-sm text-amber-200">{error}</p> : null}
    {notice?.owner === owner ? <div role="status" className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-brand/10 p-4 text-sm text-brand"><span>{notice.text}</span><button aria-label="Dismiss achievement" type="button" onClick={() => setNotice(null)} className="min-h-11 px-3">×</button></div> : null}
    {data ? <>
      <p className="mt-4 text-sm font-semibold text-brand">{data.role === 'producer' ? 'Producer goals · Beats' : data.role === 'show_creator' ? 'Show creator goals · Episodes' : 'Artist goals · Music'}</p>
      {data.current ? <><p className="mt-3 text-sm text-text-secondary">Complete each goal to fill your stars and reach the next level.</p>
        <div className="mt-4 flex flex-wrap items-center gap-2" aria-label={`${data.current.stars} of ${data.current.total} stars filled`}>{data.current.goals.map(goal => <span key={goal.id} aria-hidden="true" className={`text-3xl ${goal.done ? 'text-brand' : 'text-white/25'}`}>{goal.done ? '★' : '☆'}</span>)}<span className="ml-2 text-sm text-text-secondary">{data.current.stars}/{data.current.total} stars</span></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">{data.current.goals.map(goal => <div key={goal.id} className="rounded-2xl border border-white/10 p-4"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">{goal.label}</p><span className={goal.done ? 'text-brand' : 'text-text-secondary'} aria-label={goal.done ? 'Complete' : 'In progress'}>{goal.done ? '★' : '☆'}</span></div><p className="mt-2 text-sm text-text-secondary">{goal.value}/{goal.target}</p><progress value={Math.min(goal.value,goal.target)} max={goal.target} aria-label={goal.label} className="mt-3 h-2 w-full accent-brand" /></div>)}</div>
        <p className="mt-3 text-sm leading-6 text-text-secondary">Listener goals count distinct signed-in listeners with validated streams. Your own listening, pending streams and refunded sales do not count. Consistency means publishing in different calendar weeks.</p>
      </> : <p className="mt-4 text-sm leading-6 text-text-secondary">You completed Breakthrough. International opportunities will need verified BVS and distributed-release performance, plus a separate selection process.</p>}
      <div className="mt-5 flex flex-wrap gap-2" aria-label="Your achievements">{data.badges.map(badge => <span key={badge.badge_id} className="rounded-full border border-brand/25 bg-brand/[.06] px-3 py-2 text-sm text-brand">★ {badgeNames[badge.badge_id] || badge.badge_id}</span>)}</div>
      <div className="mt-7 flex flex-wrap items-center justify-between gap-3"><h3 className="text-xl font-semibold">Promote your work</h3><Link href={surface ? `${base}/${data.role === 'producer' ? 'beats' : 'release'}` : `${base}/manage`} className="inline-flex min-h-11 items-center text-sm text-brand">Open catalogue</Link></div>
      {!items.length ? <p className="mt-3 text-sm leading-6 text-text-secondary">Promotion tools unlock when your content is approved and published. Finish your submission or check its review status.</p> : <div className="mt-4 space-y-3">{items.map(item => <PromotionRow key={item.id} item={item} token={token} result={data.results.find(result => result.kind === item.kind && result.itemId === item.id)} onPrepared={reload} />)}</div>}
      <details className="mt-6 rounded-2xl border border-white/10 p-4"><summary className="cursor-pointer text-sm font-semibold">Levels and rewards</summary><p className="mt-3 text-sm leading-6 text-text-secondary">Launch → Momentum → Breakthrough → Global Stage. Credit rewards and affiliate earnings are not open yet. Amounts, eligibility and payout terms will be published before a paid campaign starts. Global Stage is planned for consideration for international tour support.</p><p className="mt-2 text-sm text-text-secondary">Badges recognise achievements; editorial selection and account verification are separate.</p></details>
    </> : null}
  </section>;
}

function PromotionRow({ item, token, result, onPrepared }: { item: PromotionItem; token: string; result?: Data['results'][number]; onPrepared: () => void }) {
  const [prepared, setPrepared] = useState<PromotionItem & { caption: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const ready = prepared || (result ? { ...item, path: `/go/${result.id}`, caption: promotionCaption(item) } : null);
  async function prepare() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/creator/promotions', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: item.kind, itemId: item.id }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not prepare promotion.');
      setPrepared(payload); onPrepared();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  return <div className="rounded-2xl border border-white/10 p-4"><p className="text-sm capitalize text-text-secondary">{item.kind === 'track' ? 'Music' : item.kind}</p><h4 className="mt-1 text-lg font-semibold">{item.title}</h4>
    {ready ? <><p className="mt-2 text-sm leading-6 text-text-secondary">{ready.caption}</p><div className="mt-3 flex flex-wrap gap-2"><AppShareButton title={item.title} text={ready.caption} kicker={item.kind === 'beat' ? 'Buy this beat' : item.kind === 'episode' ? 'Listen to this episode' : 'Listen and save'} path={ready.path} image={item.image || undefined} /><button type="button" className="min-h-11 rounded-full border border-white/15 px-4 text-sm" onClick={async () => { try { await navigator.clipboard.writeText(`${ready.caption}\n${canonicalBvsShareUrl(ready.path)}`); setCopied(true); } catch { setError('Could not copy. Use the Share button.'); } }}>{copied ? 'Caption copied' : 'Copy caption + link'}</button></div></> : <button type="button" disabled={busy} onClick={() => void prepare()} className="mt-3 min-h-11 rounded-full bg-brand px-4 text-sm font-semibold text-black disabled:opacity-50">{busy ? 'Preparing…' : 'Promote this'}</button>}
    {result ? <p className="mt-3 text-sm text-text-secondary">{result.visits} visitors · {result.plays} listeners · {result.saves} saves from this link</p> : null}
    <p className="mt-2 text-sm text-text-secondary">Link results are estimates and do not determine paid rewards.</p>
    {error ? <p role="alert" className="mt-2 text-sm text-amber-200">{error}</p> : null}
  </div>;
}
