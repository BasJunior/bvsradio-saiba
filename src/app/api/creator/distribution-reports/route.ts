import { NextResponse } from 'next/server';
import { creatorHeaders, creatorIdentity, creatorUrl } from '@/lib/creator-server';
import { getArtistPremiumStatus } from '@/lib/premium-billing';
import { eligibleDistributionReleaseIds } from '@/lib/distribution-reports';
const privateHeaders = {'Cache-Control':'private, no-store'};
export async function GET(request: Request) {
  const identity = await creatorIdentity(request);
  if (!identity) return NextResponse.json({error:'Sign in to view distribution reports.'},{status:401,headers:privateHeaders});
  try {
    const [premium, jobsResponse] = await Promise.all([
      getArtistPremiumStatus(identity.user.id),
      fetch(creatorUrl(`distribution_jobs?artist_user_id=eq.${identity.user.id}&select=release_id,status,updated_at&order=updated_at.desc&limit=1000`),{headers:creatorHeaders,cache:'no-store'}),
    ]);
    if (!jobsResponse.ok) throw new Error('Distribution access unavailable.');
    const releaseIds = eligibleDistributionReleaseIds(premium, await jobsResponse.json());
    if (!releaseIds.length) return NextResponse.json({eligible:false,reports:[]},{headers:privateHeaders});
    const response = await fetch(creatorUrl(`distribution_reports?artist_user_id=eq.${identity.user.id}&release_id=in.(${releaseIds.join(',')})&select=id,release_id,artist_user_id,period_start,period_end,source_reference,daily,countries,updated_at&order=updated_at.desc&limit=200`),{headers:creatorHeaders,cache:'no-store'});
    if (!response.ok) return NextResponse.json({eligible:true,reports:[],error:'Your major-DSP reports are not available yet. BVS will publish results as reporting becomes available.'},{headers:privateHeaders});
    return NextResponse.json({eligible:true,reports:await response.json()}, {headers:privateHeaders});
  } catch { return NextResponse.json({error:'Could not check distribution analytics access.'},{status:503,headers:privateHeaders}); }
}
