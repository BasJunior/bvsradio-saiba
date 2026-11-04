'use client';
import {useState} from 'react';
import {useAccountJson} from '@/lib/use-account-json';
import {useBrowserSession} from '@/lib/use-browser-session';
import DistributionReportCharts from '@/components/DistributionReportCharts';
import type {DistributionReport} from '@/lib/distribution-reports';
export default function CreatorDistributionInsights() {
  const {session}=useBrowserSession();
  const {data,error,loading,reload}=useAccountJson<{eligible:boolean;reports:DistributionReport[];error?:string}>({owner:session?.user.id || '',token:session?.access_token || '',url:'/api/creator/distribution-reports'});
  const [selected,setSelected]=useState('');
  const reports=data?.reports || [];
  const report=reports.find(row=>row.id===selected) || reports[0];
  if (!data?.eligible) return null;
  const reportError = error || data.error;
  return <section className="mt-6 border border-white/15 p-5" aria-label="Distribution analytics"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-wider text-brand">Premium · Wider stores</p><h2 className="mt-2 text-2xl font-semibold">Major-DSP analytics</h2><p className="mt-2 max-w-xl text-sm text-text-secondary">Partner-reported results for your distributed releases. These are separate from BVS playback and are not royalty statements.</p></div><button type="button" onClick={reload} disabled={loading} className="min-h-11 border border-white/15 px-4 text-xs">{loading ? 'Loading…' : 'Refresh reports'}</button></div>
    {reportError ? <p role="status" className="mt-4 text-sm text-text-secondary">{reportError}</p> : null}
    {!loading && !reportError && !report ? <p className="mt-5 border border-dashed border-white/15 p-6 text-sm text-text-secondary">No distribution report yet. Once your release has reporting data, the BVS team can publish its store and country results here.</p> : null}
    {report ? <><label className="mt-5 block text-xs text-text-secondary">Reporting snapshot<select value={report.id} onChange={event=>setSelected(event.target.value)} className="mt-2 min-h-11 w-full border border-white/15 bg-bg-primary px-3">{reports.map(row=><option key={row.id} value={row.id}>{row.source_reference} · {row.period_start} — {row.period_end} · Updated {row.updated_at.slice(0,10)}</option>)}</select></label><p className="my-4 text-xs text-text-secondary">Source: BVS distribution reporting · Updated {new Date(report.updated_at).toLocaleDateString()} · One snapshot shown; periods are not added together.</p><DistributionReportCharts report={report}/></> : null}
  </section>;
}
