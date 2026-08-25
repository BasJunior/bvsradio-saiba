-- BVS Live Phase 1 — beta/staging only.
-- Applied after supabase-bvs-live-phase1.sql on the isolated beta Supabase project.
-- Do not apply to production while Apple Review is open.

alter table public.show_streams
  add constraint show_streams_phase1_playback_matches_public
  check (playback_id = public_id);

comment on constraint show_streams_phase1_playback_matches_public on public.show_streams is
  'Phase 1 SRS emits HLS by stream name, so playback_id must equal public_id. Revisit only with an explicit media remapping layer.';
