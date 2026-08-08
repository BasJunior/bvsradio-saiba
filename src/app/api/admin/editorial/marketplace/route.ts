import { NextResponse } from 'next/server'
import { editorialIdentity, editorialUrl, serviceHeaders, audit } from '@/lib/editorial-server'

export async function GET(request: Request) {
  const identity = await editorialIdentity(request)
  if (!identity) return NextResponse.json({ error: 'Active Editorial staff access is required.' }, { status: 403 })
  const [profilesResponse,listingsResponse]=await Promise.all([
    fetch(editorialUrl('creator_marketplace_profiles?select=*,profiles!inner(username,display_name,creator_public_name)&order=updated_at.desc&limit=200'),{headers:serviceHeaders,cache:'no-store'}),
    fetch(editorialUrl('creator_marketplace_listings?select=*,profiles!inner(username,display_name,creator_public_name)&order=updated_at.desc&limit=300'),{headers:serviceHeaders,cache:'no-store'}),
  ])
  if(!profilesResponse.ok||!listingsResponse.ok)return NextResponse.json({error:'Creator Marketplace review data is unavailable.'},{status:503})
  return NextResponse.json({role:identity.role,canReview:identity.permissions.includes('approve_submissions'),profiles:await profilesResponse.json(),listings:await listingsResponse.json()})
}

export async function POST(request: Request) {
  const identity=await editorialIdentity(request)
  if(!identity||!identity.permissions.includes('approve_submissions'))return NextResponse.json({error:'Editorial approval permission is required.'},{status:403})
  const body=await request.json().catch(()=>({})) as Record<string,unknown>
  const entity=String(body.entity||''),id=String(body.id||''),decision=String(body.decision||''),notes=String(body.notes||'').trim().slice(0,2000)
  if(!id||!['approve','changes_requested','reject','publish','archive'].includes(decision))return NextResponse.json({error:'Invalid review action.'},{status:400})
  const now=new Date().toISOString()
  if(entity==='profile'){
    const status=decision==='approve'?'approved':decision==='reject'?'rejected':'changes_requested'
    const response=await fetch(editorialUrl(`creator_marketplace_profiles?user_id=eq.${encodeURIComponent(id)}`),{method:'PATCH',headers:{...serviceHeaders,Prefer:'return=representation'},body:JSON.stringify({status,review_notes:notes||null,reviewed_by:identity.user.id,reviewed_at:now,updated_at:now})})
    if(!response.ok)return NextResponse.json({error:'Could not review creator profile.'},{status:503})
    await audit(identity.user.id,`creator_marketplace_profile_${status}`,'creator_marketplace_profile',id,{notes})
    return NextResponse.json({ok:true})
  }
  if(entity==='listing'){
    const lookup=await fetch(editorialUrl(`creator_marketplace_listings?id=eq.${encodeURIComponent(id)}&select=id,listing_type,asset_path,licence_summary,rights_confirmed&limit=1`),{headers:serviceHeaders,cache:'no-store'})
    const listing=lookup.ok?(await lookup.json())[0]:null
    if(!listing)return NextResponse.json({error:'Listing not found.'},{status:404})
    if(decision==='publish'&&(listing.listing_type!=='digital_product'||!listing.asset_path||!listing.licence_summary||!listing.rights_confirmed))return NextResponse.json({error:'Only rights-confirmed digital products with a private asset and licence can publish in Phase 1.'},{status:409})
    const status=decision==='approve'?'approved':decision==='publish'?'published':decision==='archive'?'archived':decision==='reject'?'rejected':'changes_requested'
    const response=await fetch(editorialUrl(`creator_marketplace_listings?id=eq.${encodeURIComponent(id)}`),{method:'PATCH',headers:{...serviceHeaders,Prefer:'return=representation'},body:JSON.stringify({status,review_notes:notes||null,reviewed_by:identity.user.id,reviewed_at:now,published_at:status==='published'?now:null,updated_at:now})})
    if(!response.ok)return NextResponse.json({error:'Could not review marketplace listing.'},{status:503})
    await audit(identity.user.id,`creator_marketplace_listing_${status}`,'creator_marketplace_listing',id,{notes})
    return NextResponse.json({ok:true})
  }
  return NextResponse.json({error:'Invalid review entity.'},{status:400})
}
