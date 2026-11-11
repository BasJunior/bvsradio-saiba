# BVS AI Song Lab — isolated localhost prototype

**Branch:** feature/bvs-studio-song-concept-lab  
**Production:** unchanged; do not merge or deploy without review.

## Product concept

AI Song Lab is a **song-concept finisher**, not a full DAW replacement. The desktop Creator Studio
sidebar now exposes a bottom "AI Song Lab · Premium" entry to eligible accounts. Existing licensed
Song Workspaces also link into the lab with the workspace selected.

The current prototype has:
- Server-side membership checks before exposing Premium recording/transcription endpoints.
- Existing private Lyrics Pad projects and BVS licensed beat previews.
- Import of a local, licensed, full-quality instrumental for recording and a better demo bounce.
- Microphone recording with beat playback and approximate take start positions.
- Multiple local takes with mute/gain controls and a compact arrangement timeline.
- On-demand remote transcription with gpt-transcribe. Results append to the existing cloud-saved Lyrics Pad.
- An offline browser WAV render with beat/vocal gain and optional vocal high-pass/compression.
- Local (IndexedDB) raw-take persistence, including changes made after a reload.

## Run locally

From the BVS repository:

    git fetch origin
    git switch feature/bvs-studio-song-concept-lab
    npm install
    npm run dev

Open http://localhost:3000/creator/studio and sign in. The regular Artist Premium eligibility
check requires the existing Supabase environment and membership/account records.

For **local development only**, add to .env.local:

    BVS_SONG_LAB_DEV_ACCESS=true
    BVS_SONG_LAB_OPENAI_KEY=your_server_side_api_key

The dev entitlement bypass works only with NODE_ENV=development. It does not bypass sign-in.
The API key is optional for recording and mixing, but required for AI transcription; never use a
NEXT_PUBLIC_ prefix and never commit credentials.

Start a song in /lyrics, or open an existing licensed Song Workspace. Choose the project in
/creator/studio/ai-song-lab. Allow microphone access. Use headphones. Record a take, stop,
transcribe it, edit its lyrics, play the rough concept and export a demo WAV.

## Boundaries and outstanding work

1. **Raw takes are browser-local only.** Lyrics and song metadata save through the existing
   authenticated Song Workspace API; vocal recordings do not sync across devices. Export or back
   up the WAV before clearing site data. Add private R2 media uploads with time-limited access,
   quotas and retention rules before launching this feature publicly.
2. The remote beat in Song Workspace is currently **a preview**. It may be watermarked or
   reduced quality. Imported local audio is not transferred to BVS. For any commercial
   release, enforce beat purchase/licence permissions and use a verified full master.
3. Rough in-browser playback uses multiple HTML audio players and timers. Timing can drift,
   especially on mobile. WAV export uses a single OfflineAudioContext timeline, but needs
   waveform editing, precise monitoring and latency calibration before production.
4. The current clean-vocal preset is deterministic DSP, **not AI mastering**. Add opt-in
   assisted mix recommendations, intelligent sections, clip trims/comping, and more sophisticated
   processing after testing the core flow.
5. Transcriptions can be wrong, particularly with singing, ad-libs, slang and code-switching.
   Artists must edit lyrics before releasing. Audio files are sent to the configured external
   transcription provider only when the user clicks "Transcribe".
6. Add metered transcription quotas, abuse protection, size/duration limits, costs/billing,
   cloud-project backups and better mobile accessibility before public release.
7. Browser permissions require localhost or HTTPS. Desktop Chrome/Edge should be tested first,
   followed by Safari, iOS and Android.

## Manual localhost acceptance checklist

- Premium member sees the bottom sidebar entry; non-Premium does not and direct URL is gated.
- Create/open blank Lyrics Pad project; import a beat; record, pause/stop and play take.
- Open licensed Lyrics Pad beat; enter AI Song Lab with preselected project.
- Record two takes at different start positions; confirm timeline, mute, gain and playback.
- Refresh browser; confirm local takes remain and private lyrics are still saved.
- Run transcription with an API key; confirm editable text appears in Lyrics Pad.
- Render and download WAV; verify length, beat, vocal balance and playback in a separate player.
- Test denied mic permission, no key, storage denied, network failure and expired Premium.
- Verify no files/changes are merged to main and no production deployment is triggered.

No production build or live recording QA is claimed for this branch until those checks pass.
