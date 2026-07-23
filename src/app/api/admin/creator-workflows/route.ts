import { NextResponse } from 'next/server'
import { audit, can, editorialIdentity, editorialUrl, serviceHeaders } from '@/lib/editorial-server'

const clean = (value: unknown, max = 5000) => String(value || '').trim().slice(0, max)
async function json(response: Response) { const data = await response.json().catch(() => null); if (!response.ok) throw new Error(data?.message || 'Editorial workflow request failed.'); return data }

export async function GET(request: Request) {
  const identity = await editorialIdentity(request)
  if (!identity || !can(identity, 'approve_submissions')) return NextResponse.json({ error: 'Editorial review access required.' }, { status: identity ? 403 : 401 })
  const paths = [
    'writer_applications?select=*&order=created_at.desc', 'editorial_articles?select=*&order=updated_at.desc',
    'research_briefs?select=*&order=updated_at.desc', 'show_creator_profiles?select=*&order=updated_at.desc',
    'show_episodes?select=*&order=updated_at.desc', 'profiles?select=id,username,display_name,role&limit=300',
  ]
  const responses = await Promise.all(paths.map(path => fetch(editorialUrl(path), { headers: serviceHeaders, cache: 'no-store' })))
  if (responses.some(response => !response.ok)) return NextResponse.json({ error: 'Creator workflow tables are not ready.' }, { status: 503 })
  const [applications, articles, briefs, shows, episodes, profiles] = await Promise.all(responses.map(response => response.json()))
  return NextResponse.json({ applications, articles, briefs, shows, episodes, profiles })
}

export async function POST(request: Request) {
  const identity = await editorialIdentity(request)
  if (!identity || !can(identity, 'approve_submissions')) return NextResponse.json({ error: 'Editorial review access required.' }, { status: identity ? 403 : 401 })
  const body = await request.json().catch(() => ({})) as Record<string, unknown>; const action = clean(body.action, 50); const now = new Date().toISOString()
  try {
    if (action === 'create_brief') {
      const topic = clean(body.topic, 200); if (!topic) return NextResponse.json({ error: 'Topic is required.' }, { status: 400 })
      const sourceLinks = Array.isArray(body.sourceLinks) ? body.sourceLinks.map(item => clean(item, 1000)).filter(Boolean).slice(0, 20) : []
      const data = await json(await fetch(editorialUrl('research_briefs'), { method: 'POST', headers: { ...serviceHeaders, Prefer: 'return=representation' }, body: JSON.stringify({ created_by: identity.user.id, assigned_to: clean(body.assignedTo, 80) || null, topic, angle: clean(body.angle, 2000), findings: clean(body.findings, 20000), seo_suggestions: clean(body.seoSuggestions, 3000), source_links: sourceLinks, status: 'ready_for_review' }) }))
      await audit(identity.user.id, 'research_brief_created', 'research_brief', data[0].id, { human_approval_required: true }); return NextResponse.json({ item: data[0] })
    }
    const tableByAction: Record<string,string> = { review_writer: 'writer_applications', review_article: 'editorial_articles', review_brief: 'research_briefs', review_show: 'show_creator_profiles', review_episode: 'show_episodes' }
    const table = tableByAction[action]; const itemId = clean(body.id, 80); const status = clean(body.status, 40)
    if (!table || !itemId) return NextResponse.json({ error: 'Unknown review action.' }, { status: 400 })
    const allowed: Record<string,string[]> = {
      writer_applications:['approved','rejected','paused'], editorial_articles:['in_review','changes_requested','approved','scheduled','published','rejected'],
      research_briefs:['approved_for_drafting','rejected','archived'], show_creator_profiles:['approved','rejected','paused'],
      show_episodes:['in_review','changes_requested','approved','scheduled','published','rejected'],
    }
    if (!allowed[table].includes(status)) return NextResponse.json({ error: 'Invalid review status.' }, { status: 400 })
    if (table === 'research_briefs' && status === 'approved_for_drafting' && body.publish === true) return NextResponse.json({ error: 'Research briefs can never publish automatically.' }, { status: 400 })
    const payload: Record<string,unknown> = { status, reviewed_by: identity.user.id, reviewed_at: now, updated_at: now }
    if (table !== 'research_briefs') payload.review_notes = clean(body.notes, 5000)
    if (['editorial_articles','show_episodes'].includes(table)) {
      payload.editor_notes = clean(body.notes, 5000)
      if (status === 'scheduled') { const scheduled = new Date(clean(body.scheduledFor, 80)); if (Number.isNaN(scheduled.getTime()) || scheduled <= new Date()) return NextResponse.json({ error: 'Choose a future schedule time.' }, { status: 400 }); payload.scheduled_for = scheduled.toISOString() }
      if (status === 'published') payload.published_at = now
    }
    const data = await json(await fetch(editorialUrl(`${table}?id=eq.${encodeURIComponent(itemId)}`), { method: 'PATCH', headers: { ...serviceHeaders, Prefer: 'return=representation' }, body: JSON.stringify(payload) }))
    await audit(identity.user.id, `${action}_${status}`, table, itemId, { notes: clean(body.notes, 500) }); return NextResponse.json({ item: data[0] })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Review failed.' }, { status: 500 }) }
}
