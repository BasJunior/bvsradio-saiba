from pathlib import Path
import json


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"Expected block not found in {path}: {old[:140]!r}")
    p.write_text(text.replace(old, new, 1))


# A shared player for trusted/owner/staff contexts. It has no time cap; the
# server decides whether the caller receives a full private source or a public preview.
Path('src/components/FullAccessAudioPlayer.tsx').write_text("""'use client'

import { useStationPlayer } from '@/components/StationPlayer'

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const whole = Math.floor(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

export default function FullAccessAudioPlayer({
  accessId,
  title,
  artist,
  src,
  artwork,
  sourceLabel = 'Full access playback',
  genre,
  compact = false,
}: {
  accessId: string
  title: string
  artist: string
  src?: string | null
  artwork?: string | null
  sourceLabel?: string
  genre?: string
  compact?: boolean
}) {
  const player = useStationPlayer()
  const active = Boolean(src) && player.current?.src === src && player.playingFrom === sourceLabel
  const elapsed = active ? player.elapsed : 0
  const duration = active ? player.duration : 0
  const progress = duration > 0 ? Math.min(1, Math.max(0, elapsed / duration)) : 0

  if (!src) {
    return <div className=\"rounded-xl border border-dashed border-white/10 px-3 py-2 text-xs text-text-secondary\">Full audio is not attached to this submission.</div>
  }

  const toggle = () => {
    if (active) {
      player.toggle()
      return
    }
    player.playNow({
      id: '',
      title,
      artist,
      src,
      artwork: artwork || undefined,
      project: sourceLabel,
      genre,
      isDownloadable: false,
      licenceType: 'not_for_sale',
    }, { from: sourceLabel, related: [] })
  }

  return (
    <div data-full-access-audio={accessId} className={`flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-white/[.055] ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'}`}>
      <button
        type=\"button\"
        onClick={toggle}
        className={`${compact ? 'h-9 w-9' : 'h-10 w-10'} grid shrink-0 place-items-center rounded-full bg-white text-sm font-black text-black`}
        aria-label={`${active && player.isPlaying ? 'Pause' : 'Play full audio'} ${title}`}
      >
        {active && player.isPlaying ? 'Ⅱ' : '▶'}
      </button>
      <span className=\"w-10 shrink-0 text-right text-[11px] tabular-nums text-text-secondary\">{formatTime(elapsed)}</span>
      <input
        type=\"range\"
        min=\"0\"
        max=\"1000\"
        value={Math.round(progress * 1000)}
        disabled={!active || duration <= 0}
        onChange={(event) => player.seek(Number(event.target.value) / 1000)}
        className=\"min-w-20 flex-1 accent-brand disabled:opacity-45\"
        aria-label={`Seek ${title}`}
      />
      <span className=\"w-10 shrink-0 text-[11px] tabular-nums text-text-secondary\">{duration > 0 ? `-${formatTime(Math.max(0, duration - elapsed))}` : '0:00'}</span>
    </div>
  )
}
""")

# Editorial data API: staff get signed full sources. Public APIs remain preview-only.
replace_once(
    'src/app/api/admin/editorial/route.ts',
    """      preview_path: await signStoredMedia(String(beat.preview_path || '')),
      artwork_path: await signStoredMedia(String(beat.artwork_path || '')),""",
    """      preview_path: await signStoredMedia(String(beat.preview_path || '')),
      master_path: await signStoredMedia(String(beat.master_path || '')),
      review_audio_url: await signStoredMedia(String(beat.master_path || beat.preview_path || '')),
      artwork_path: await signStoredMedia(String(beat.artwork_path || '')),""",
)
replace_once(
    'src/app/api/admin/editorial/route.ts',
    """  const releaseTracks = (rawReleaseTracks as Array<Record<string, unknown>>).map((track) => ({
    ...track,
    in_rotation: track.track_id ? rotationByTrackId.get(String(track.track_id)) === true : false,
    isrc: track.track_id ? isrcByTrackId.get(String(track.track_id)) || null : null,
  }))""",
    """  const releaseTracks = await Promise.all((rawReleaseTracks as Array<Record<string, unknown>>).map(async (track) => ({
    ...track,
    file_url: await signStoredMedia(String(track.file_url || track.audio_path || '')),
    review_audio_url: await signStoredMedia(String(track.file_url || track.audio_path || '')),
    in_rotation: track.track_id ? rotationByTrackId.get(String(track.track_id)) === true : false,
    isrc: track.track_id ? isrcByTrackId.get(String(track.track_id)) || null : null,
  })))""",
)

# Editorial command drawer: a beat uses master/full source when one exists.
replace_once(
    'src/app/api/admin/editorial/work-item/route.ts',
    "audio: await signStoredMedia(text(beat.preview_path))",
    "audio: await signStoredMedia(text(beat.master_path) || text(beat.preview_path))",
)

# Main Editorial workflow: BeatStore uses review_audio_url/master, not public preview.
replace_once(
    'src/app/admin/editorial/page.tsx',
    "type Beat = { id: string; producer_user_id: string; title: string; genre?: string; mood?: string; bpm?: number | null; status: string; is_public: boolean; preview_path?: string | null; artwork_path?: string | null; editorial_notes?: string | null; created_at: string; beat_licence_options?: BeatLicence[] }",
    "type Beat = { id: string; producer_user_id: string; title: string; genre?: string; mood?: string; bpm?: number | null; status: string; is_public: boolean; preview_path?: string | null; master_path?: string | null; review_audio_url?: string | null; artwork_path?: string | null; editorial_notes?: string | null; created_at: string; beat_licence_options?: BeatLicence[] }",
)
replace_once(
    'src/app/admin/editorial/page.tsx',
    "type ReleaseTrack = { id: string; release_id: string; position: number; title: string; file_url?: string; in_rotation?: boolean; isrc?: string | null; track_id?: string | null }",
    "type ReleaseTrack = { id: string; release_id: string; position: number; title: string; file_url?: string; review_audio_url?: string; in_rotation?: boolean; isrc?: string | null; track_id?: string | null }",
)
replace_once(
    'src/app/admin/editorial/page.tsx',
    "const audioSrc = publicUrl(beat.preview_path)",
    "const audioSrc = beat.review_audio_url || beat.master_path || publicUrl(beat.preview_path)",
)

# Release Editorial: play the signed full submitted source and remove the secondary
# processing-preview player that could be clipped/transcoded.
replace_once(
    'src/components/ReleaseEditorialPanel.tsx',
    "  file_url?: string\n  in_rotation?: boolean",
    "  file_url?: string\n  review_audio_url?: string\n  in_rotation?: boolean",
)
replace_once(
    'src/components/ReleaseEditorialPanel.tsx',
    """                        {m.file_url && (
                          <div className=\"mt-2\"><EditorialConnectedPreview previewId={`release-track:${m.id}`} title={m.title} artist={release.artist_name} src={m.file_url} artwork={release.cover_url} project={`Editorial · ${release.title}`} genre={release.genre} compact /></div>
                        )}""",
    """                        {(m.review_audio_url || m.file_url) && (
                          <div className=\"mt-2\"><EditorialConnectedPreview previewId={`release-track:${m.id}`} title={m.title} artist={release.artist_name} src={m.review_audio_url || m.file_url} artwork={release.cover_url} project={`Editorial · ${release.title} · full submission`} genre={release.genre} compact /></div>
                        )}""",
)
replace_once(
    'src/components/ReleaseEditorialPanel.tsx',
    "{media?.preview_path && <audio controls preload=\"none\" src={media.preview_path} className=\"mt-2 h-8 max-w-full\" />}",
    "{media?.preview_path && <p className=\"mt-2 text-[11px] text-text-secondary\">Processing preview generated for QC. Use the full submission player above for editorial listening.</p>}",
)

# Owner BeatStore: the private scope already signs master_path; expose it in the UI.
replace_once(
    'src/components/MyBeatStore.tsx',
    "import { isAllowedAudioFile } from '@/lib/audio-formats'",
    "import { isAllowedAudioFile } from '@/lib/audio-formats'\nimport FullAccessAudioPlayer from '@/components/FullAccessAudioPlayer'",
)
replace_once(
    'src/components/MyBeatStore.tsx',
    """  preview_path?: string | null
  editorial_notes?: string | null""",
    """  preview_path?: string | null
  master_path?: string | null
  artwork_path?: string | null
  editorial_notes?: string | null""",
)
replace_once(
    'src/components/MyBeatStore.tsx',
    """                  {beat.editorial_notes && (
                    <p className=\"mt-2 text-sm text-text-secondary\">Editor: {beat.editorial_notes}</p>
                  )}
                  <div className=\"mt-3 rounded-lg border border-white/10 bg-black/20 p-3\">""",
    """                  {beat.editorial_notes && (
                    <p className=\"mt-2 text-sm text-text-secondary\">Editor: {beat.editorial_notes}</p>
                  )}
                  <div className=\"mt-3\">
                    <FullAccessAudioPlayer accessId={`studio-beat:${beat.id}`} title={beat.title} artist=\"Your BeatStore submission\" src={beat.master_path || beat.preview_path} artwork={beat.artwork_path} sourceLabel=\"Studio · your full beat\" genre={beat.genre} compact />
                  </div>
                  <div className=\"mt-3 rounded-lg border border-white/10 bg-black/20 p-3\">""",
)

# Creator workspace: owner-only API returns signed full track/release/episode audio.
replace_once(
    'src/app/api/creator/workspace/route.ts',
    "import { r2Configured, r2ObjectExists } from '@/lib/r2-storage'",
    "import { r2Configured, r2KeyFromMediaUrl, r2ObjectExists, safeR2Key, signedR2DownloadUrl } from '@/lib/r2-storage'",
)
replace_once(
    'src/app/api/creator/workspace/route.ts',
    """const hasCreatorAccess = (profile: { role: string; is_producer?: boolean }) =>
  profile.role !== 'listener' || profile.is_producer === true
""",
    """const hasCreatorAccess = (profile: { role: string; is_producer?: boolean }) =>
  profile.role !== 'listener' || profile.is_producer === true

async function privateMediaUrl(value?: string | null) {
  if (!value) return value
  const key = r2KeyFromMediaUrl(value) || (safeR2Key(value) && !/^https?:/i.test(value) ? value : null)
  return key ? signedR2DownloadUrl(key, 900) : value
}
""",
)
replace_once(
    'src/app/api/creator/workspace/route.ts',
    "tracks?user_id=eq.${id}&select=id,title,genre,artwork_url,editorial_status,editorial_notes,is_public,in_rotation,is_downloadable,download_price,licence_type,play_count,like_count,created_at,updated_at,release_id,isrc,spotify_url&order=created_at.desc",
    "tracks?user_id=eq.${id}&select=id,title,artist_name,genre,file_url,artwork_url,editorial_status,editorial_notes,is_public,in_rotation,is_downloadable,download_price,licence_type,play_count,like_count,created_at,updated_at,release_id,isrc,spotify_url&order=created_at.desc",
)
replace_once(
    'src/app/api/creator/workspace/route.ts',
    "tracks?user_id=eq.${id}&select=id,title,genre,artwork_url,editorial_status,editorial_notes,is_public,in_rotation,is_downloadable,download_price,licence_type,play_count,like_count,created_at,updated_at&order=created_at.desc",
    "tracks?user_id=eq.${id}&select=id,title,artist_name,genre,file_url,artwork_url,editorial_status,editorial_notes,is_public,in_rotation,is_downloadable,download_price,licence_type,play_count,like_count,created_at,updated_at&order=created_at.desc",
)
replace_once(
    'src/app/api/creator/workspace/route.ts',
    """  const trackRequests = requestsResponse.ok ? await requestsResponse.json() : []
  const releases = releasesResponse.ok ? await releasesResponse.json() : []
  const distributionJobs = jobsResponse.ok ? await jobsResponse.json() : []""",
    """  const rawTracks = Array.isArray(tracks) ? tracks as Array<Record<string, unknown>> : []
  tracks = await Promise.all(rawTracks.map(async (track) => ({
    ...track,
    file_url: await privateMediaUrl(String(track.file_url || '')),
    artwork_url: await privateMediaUrl(String(track.artwork_url || '')),
  })))
  const trackRequests = requestsResponse.ok ? await requestsResponse.json() : []
  const releases = releasesResponse.ok ? await releasesResponse.json() : []
  const releaseIds = (Array.isArray(releases) ? releases : []).map((release: Record<string, unknown>) => String(release.id || '')).filter(Boolean)
  const releaseTracksResponse = releaseIds.length
    ? await fetch(creatorUrl(`release_tracks?release_id=in.(${releaseIds.join(',')})&select=id,release_id,position,title,file_url,audio_path&order=position.asc&limit=1000`), { headers: creatorHeaders, cache: 'no-store' })
    : null
  const rawReleaseTracks = releaseTracksResponse?.ok ? await releaseTracksResponse.json() as Array<Record<string, unknown>> : []
  const releaseTracks = await Promise.all(rawReleaseTracks.map(async (track) => ({
    ...track,
    file_url: await privateMediaUrl(String(track.file_url || track.audio_path || '')),
  })))
  const distributionJobs = jobsResponse.ok ? await jobsResponse.json() : []""",
)
replace_once(
    'src/app/api/creator/workspace/route.ts',
    "const pathBundle = { releases, distributionJobs, profileFlags }",
    "const pathBundle = { releases, releaseTracks, distributionJobs, profileFlags }",
)
replace_once(
    'src/app/api/creator/workspace/route.ts',
    """  const [applications, articles, briefs, shows, episodes] = await Promise.all(responses.map(response => response.json()))
  return NextResponse.json({""",
    """  const [applications, articles, briefs, shows, rawEpisodes] = await Promise.all(responses.map(response => response.json()))
  const episodes = await Promise.all((Array.isArray(rawEpisodes) ? rawEpisodes : []).map(async (episode: Record<string, unknown>) => ({
    ...episode,
    audio_url: await privateMediaUrl(String(episode.audio_path || '')),
  })))
  return NextResponse.json({""",
)

# Studio UI: own singles, album/EP members and episodes get full owner playback.
replace_once(
    'src/app/creator/studio/manage/page.tsx',
    "import DistributionPathTimeline from \"@/components/DistributionPathTimeline\";",
    "import DistributionPathTimeline from \"@/components/DistributionPathTimeline\";\nimport FullAccessAudioPlayer from \"@/components/FullAccessAudioPlayer\";",
)
replace_once(
    'src/app/creator/studio/manage/page.tsx',
    """  review_notes?: string;
  scheduled_for?: string;
};""",
    """  review_notes?: string;
  scheduled_for?: string;
  audio_url?: string;
};""",
)
replace_once(
    'src/app/creator/studio/manage/page.tsx',
    """  title: string;
  genre?: string;
  editorial_status: string;""",
    """  title: string;
  artist_name?: string;
  genre?: string;
  file_url?: string;
  artwork_url?: string;
  editorial_status: string;""",
)
replace_once(
    'src/app/creator/studio/manage/page.tsx',
    """type DistJob = {
  id: string;""",
    """type ReleaseMember = {
  id: string;
  release_id: string;
  position: number;
  title: string;
  file_url?: string;
};
type DistJob = {
  id: string;""",
)
replace_once(
    'src/app/creator/studio/manage/page.tsx',
    """  releases?: AlbumRelease[];
  distributionJobs?: DistJob[];""",
    """  releases?: AlbumRelease[];
  releaseTracks?: ReleaseMember[];
  distributionJobs?: DistJob[];""",
)
replace_once(
    'src/app/creator/studio/manage/page.tsx',
    """            <ArtistReleases tracks={data.tracks || []} requests={data.trackRequests || []} jobs={data.distributionJobs || []} releases={data.releases || []} flags={data.profileFlags} act={act} />""",
    """            <ArtistReleases tracks={data.tracks || []} requests={data.trackRequests || []} jobs={data.distributionJobs || []} releases={data.releases || []} releaseTracks={data.releaseTracks || []} flags={data.profileFlags} act={act} />""",
)
replace_once(
    'src/app/creator/studio/manage/page.tsx',
    """  releases,
  flags,
  act,""",
    """  releases,
  releaseTracks,
  flags,
  act,""",
)
replace_once(
    'src/app/creator/studio/manage/page.tsx',
    """  releases: AlbumRelease[];
  flags?: ProfileFlags;""",
    """  releases: AlbumRelease[];
  releaseTracks: ReleaseMember[];
  flags?: ProfileFlags;""",
)
replace_once(
    'src/app/creator/studio/manage/page.tsx',
    """                  {release.editorial_notes && (
                    <p className=\"mt-3 text-sm text-text-secondary\">
                      Editor: {release.editorial_notes}
                    </p>
                  )}""",
    """                  {release.editorial_notes && (
                    <p className=\"mt-3 text-sm text-text-secondary\">
                      Editor: {release.editorial_notes}
                    </p>
                  )}
                  {releaseTracks.filter((member) => member.release_id === release.id).map((member) => (
                    <div key={member.id} className=\"mt-3 rounded-xl border border-white/10 p-3\">
                      <p className=\"mb-2 text-xs text-text-secondary\">{member.position}. {member.title}</p>
                      <FullAccessAudioPlayer accessId={`studio-release:${member.id}`} title={member.title} artist={release.artist_name || 'Your submission'} src={member.file_url} sourceLabel={`Studio · ${release.title} · full submission`} compact />
                    </div>
                  ))}""",
)
replace_once(
    'src/app/creator/studio/manage/page.tsx',
    """                {track.editorial_notes && (
                  <p className=\"mt-3 text-sm text-text-secondary\">
                    Editor: {track.editorial_notes}
                  </p>
                )}""",
    """                {track.editorial_notes && (
                  <p className=\"mt-3 text-sm text-text-secondary\">
                    Editor: {track.editorial_notes}
                  </p>
                )}
                <div className=\"mt-3\">
                  <FullAccessAudioPlayer accessId={`studio-track:${track.id}`} title={track.title} artist={track.artist_name || 'Your submission'} src={track.file_url} artwork={track.artwork_url} sourceLabel=\"Studio · your full submission\" genre={track.genre} compact />
                </div>""",
)
replace_once(
    'src/app/creator/studio/manage/page.tsx',
    """            {item.scheduled_for && (
              <p className=\"mt-2 text-xs text-text-secondary\">
                Scheduled {new Date(item.scheduled_for).toLocaleString()}
              </p>
            )}""",
    """            {item.scheduled_for && (
              <p className=\"mt-2 text-xs text-text-secondary\">
                Scheduled {new Date(item.scheduled_for).toLocaleString()}
              </p>
            )}
            {item.audio_url && (
              <div className=\"mt-3\"><FullAccessAudioPlayer accessId={`studio-work:${item.id}`} title={item.title || item.topic || 'Submission'} artist=\"Your submission\" src={item.audio_url} sourceLabel=\"Studio · your full submission\" compact /></div>
            )}""",
)

# Regression coverage: privileged contexts receive full sources; public BeatStore stays preview-only.
Path('scripts/privileged-full-audio-tests.mjs').write_text("""import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')
const assert = (condition, message) => { if (!condition) throw new Error(message) }

const fullPlayer = read('src/components/FullAccessAudioPlayer.tsx')
const editorialApi = read('src/app/api/admin/editorial/route.ts')
const workItem = read('src/app/api/admin/editorial/work-item/route.ts')
const editorialPage = read('src/app/admin/editorial/page.tsx')
const releases = read('src/components/ReleaseEditorialPanel.tsx')
const mine = read('src/app/api/beats/route.ts')
const myBeats = read('src/components/MyBeatStore.tsx')
const creatorApi = read('src/app/api/creator/workspace/route.ts')
const studio = read('src/app/creator/studio/manage/page.tsx')

assert(fullPlayer.includes('useStationPlayer'), 'trusted playback must use the persistent BVS player')
assert(!/45\s*\*|>=\s*45|>\s*45|max(?:imum)?Duration.{0,20}45/i.test(fullPlayer), 'trusted playback must not impose a 45-second cap')
assert(editorialApi.includes('review_audio_url: await signStoredMedia(String(beat.master_path || beat.preview_path'), 'Editorial beats prefer the private master/full source')
assert(editorialApi.includes("file_url: await signStoredMedia(String(track.file_url || track.audio_path"), 'Editorial release tracks receive signed full submitted audio')
assert(workItem.includes('text(beat.master_path) || text(beat.preview_path)'), 'Editorial work drawer prefers full beat master')
assert(editorialPage.includes('beat.review_audio_url || beat.master_path'), 'BeatStore Editorial uses trusted full review audio')
assert(releases.includes('m.review_audio_url || m.file_url'), 'Album/EP Editorial uses full submitted member audio')
assert(!releases.includes('<audio controls preload="none" src={media.preview_path}'), 'Editorial must not expose the clipped processing preview as its review player')
assert(mine.includes('master_path: await privateMediaUrl(beat.master_path)'), 'Owner BeatStore API signs the private master')
assert(myBeats.includes('src={beat.master_path || beat.preview_path}'), 'Producer listening to own submission prefers the full master')
assert(creatorApi.includes('file_url: await privateMediaUrl(String(track.file_url'), 'Artist workspace signs full owned single audio')
assert(creatorApi.includes('releaseTracks'), 'Artist workspace returns owned album/EP member audio')
assert(creatorApi.includes('audio_url: await privateMediaUrl(String(episode.audio_path'), 'Show creator gets full own episode audio')
assert(studio.includes('FullAccessAudioPlayer'), 'Studio exposes full owner playback')

// Public BeatStore shaping stays on previewUrl and never returns master_path in the public object.
const publicShape = mine.slice(mine.indexOf('// public published beats for catalogue / BeatStore'))
assert(publicShape.includes('previewUrl: publicStorageUrl(b.preview_path)'), 'Public BeatStore continues to use preview audio')
assert(!publicShape.includes('masterUrl:'), 'Public BeatStore must not expose private masters')

console.log('privileged full-audio checks passed')
""")

pkg_path = Path('package.json')
pkg = json.loads(pkg_path.read_text())
pkg['scripts']['test:privileged-audio'] = 'node scripts/privileged-full-audio-tests.mjs'
for key in ('build', 'vercel-build'):
    value = pkg['scripts'][key]
    if 'test:privileged-audio' not in value:
        value = value.replace('next build', 'npm run test:privileged-audio && next build')
        pkg['scripts'][key] = value
pkg_path.write_text(json.dumps(pkg, indent=2) + '\n')
