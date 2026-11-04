import { NextResponse } from 'next/server';
import { can, editorialIdentity, editorialUrl, serviceHeaders } from '@/lib/editorial-server';
import { validateDistributionReport } from '@/lib/distribution-reports';
async function rows(path: string) { const response = await fetch(editorialUrl(path),{headers:serviceHeaders,cache:'no-store'}); if (!response.ok) throw new Error('Reporting storage unavailable. Apply the distribution reports migration.'); return response.json(); }
export async function GET(request: Request) {
  const identity = await editorialIdentity(request);
  if (!identity || !can(identity,'approve_submissions')) return NextResponse.json({error:'Distribution editorial access required.'},{status:403});
  try {
    const [jobs, reports] = await Promise.all([rows('distribution_jobs?select=release_id,artist_user_id,status&release_id=not.is.null&order=updated_at.desc&limit=1000'),rows('distribution_reports?select=*&order=updated_at.desc&limit=200').catch(() => null)]);
    const ids = [...new Set(jobs.map((job: {release_id: string}) => job.release_id))];
    const releases = ids.length ? await rows(`releases?id=in.(${ids.join(',')})&select=id,title,user_id,artist_name&limit=1000`) : [];
    return NextResponse.json({releases,reports: reports || [], storageReady: reports !== null},{headers:{'Cache-Control':'private, no-store'}});
  } catch { return NextResponse.json({error:'Reporting storage unavailable. Apply the distribution reports migration.'},{status:503}); }
}
export async function POST(request: Request) {
  const identity = await editorialIdentity(request);
  if (!identity || !can(identity,'approve_submissions')) return NextResponse.json({error:'Distribution editorial access required.'},{status:403});
  if (Number(request.headers.get('content-length') || 0) > 250000) return NextResponse.json({error:'Report too large.'},{status:413});
  let input; let report;
  try { const text = await request.text(); if (text.length > 250000) throw new Error('Report too large.'); input = JSON.parse(text); if (!/^[a-f0-9-]{36}$/i.test(input.release_id || '')) throw new Error('Select a release.'); report = validateDistributionReport(input); }
  catch (error) { return NextResponse.json({error:error instanceof Error ? error.message : 'Invalid report.'},{status:400}); }
  try {
    const releases = await rows(`releases?id=eq.${input.release_id}&select=id,user_id&limit=1`);
    const jobs = await rows(`distribution_jobs?release_id=eq.${input.release_id}&artist_user_id=eq.${releases[0]?.user_id || '00000000-0000-0000-0000-000000000000'}&select=id&limit=1`);
    if (!releases[0] || !jobs.length) return NextResponse.json({error:'Release must have an existing distribution job for its owner.'},{status:400});
    const response = await fetch(editorialUrl('distribution_reports'),{method:'POST',headers:{...serviceHeaders,Prefer:'return=representation'},body:JSON.stringify({...report,release_id:input.release_id,artist_user_id:releases[0].user_id,created_by:identity.user.id})});
    if (!response.ok) throw new Error('Could not save report.');
    return NextResponse.json({report:(await response.json())[0]},{headers:{'Cache-Control':'private, no-store'}});
  } catch { return NextResponse.json({error:'Could not save report. Check reporting storage and retry.'},{status:503}); }
}
