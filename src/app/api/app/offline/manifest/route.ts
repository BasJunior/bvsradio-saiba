import path from "node:path";
import { NextResponse } from "next/server";
import { communityUser } from "@/lib/community-server";
import { editorialUrl, serviceHeaders } from "@/lib/editorial-server";
import { mediaKeyFromStoredValue, mediaUrlForStoredValue } from "@/lib/media-url";
import { r2Configured, r2ObjectExists, safeR2Key, signedR2DownloadUrl } from "@/lib/r2-storage";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SURFACES=new Set(["ios","android"]);
const LICENSE_SECONDS=7*24*60*60;
const DOWNLOAD_URL_SECONDS=10*60;

type Clearance={track_id:string;surface:"ios"|"android";status:string;reviewed_at?:string|null;updated_at?:string|null};
type Track={id:string;title:string;artist_name?:string|null;file_url:string;artwork_url?:string|null;genre?:string|null;is_public:boolean;in_rotation:boolean;editorial_status:string};

export async function GET(request:Request){
  const user=await communityUser(request);
  if(!user)return NextResponse.json({error:"Sign in to download BVS music."},{status:401});
  if(!serviceHeaders.apikey||!r2Configured())return NextResponse.json({error:"Offline media is not configured."},{status:503});
  const url=new URL(request.url),trackId=(url.searchParams.get("trackId")||"").trim(),surface=(url.searchParams.get("surface")||"").trim();
  if(!UUID.test(trackId)||!SURFACES.has(surface))return NextResponse.json({error:"Invalid offline request."},{status:400});
  const clearResponse=await fetch(editorialUrl(`mobile_distribution_clearances?track_id=eq.${encodeURIComponent(trackId)}&surface=eq.${surface}&status=eq.cleared&select=track_id,surface,status,reviewed_at,updated_at&limit=1`),{headers:serviceHeaders,cache:"no-store"});
  if(!clearResponse.ok)return NextResponse.json({error:"Offline rights could not be verified."},{status:503});
  const clearance=((await clearResponse.json()) as Clearance[])[0];
  if(!clearance)return NextResponse.json({error:"This recording is not cleared for offline use on this device."},{status:403});
  const trackResponse=await fetch(editorialUrl(`tracks?id=eq.${encodeURIComponent(trackId)}&is_public=eq.true&in_rotation=eq.true&editorial_status=eq.approved&select=id,title,artist_name,file_url,artwork_url,genre,is_public,in_rotation,editorial_status&limit=1`),{headers:serviceHeaders,cache:"no-store"});
  if(!trackResponse.ok)return NextResponse.json({error:"Track rights could not be verified."},{status:503});
  const track=((await trackResponse.json()) as Track[])[0];
  if(!track?.file_url)return NextResponse.json({error:"This recording is not available for offline use."},{status:404});
  const mediaKey=mediaKeyFromStoredValue(track.file_url);
  if(!mediaKey||!safeR2Key(mediaKey)||!await r2ObjectExists(mediaKey))return NextResponse.json({error:"This recording has no private offline master."},{status:409});
  const ext=path.extname(mediaKey).replace(/[^.a-z0-9]/gi,"").slice(0,10)||".audio";
  const filename=`${(track.title||"bvs-track").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"bvs-track"}${ext}`;
  const issuedAt=new Date(),validUntil=new Date(issuedAt.getTime()+LICENSE_SECONDS*1000);
  const downloadUrl=await signedR2DownloadUrl(mediaKey,DOWNLOAD_URL_SECONDS,filename);
  return NextResponse.json({manifest:{version:1,trackId:track.id,surface,title:track.title,artist:track.artist_name||"BVS Radio",genre:track.genre||null,artworkUrl:mediaUrlForStoredValue(track.artwork_url),downloadUrl,downloadUrlExpiresAt:new Date(issuedAt.getTime()+DOWNLOAD_URL_SECONDS*1000).toISOString(),licenseIssuedAt:issuedAt.toISOString(),licenseValidUntil:validUntil.toISOString(),requiresRevalidation:true,storagePolicy:"app-private",exportAllowed:false,clearanceReviewedAt:clearance.reviewed_at||clearance.updated_at||null}},{headers:{"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"}});
}
