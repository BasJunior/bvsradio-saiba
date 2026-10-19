-- Browser-compatible copies of the already-approved FRESHMAN MUSIK FLAC album.
-- Original audio objects and verified media-processing records remain intact.
-- Apply only after all ten new R2 objects pass codec, duration, and playback checks.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE TEMP TABLE bvs_flac_repair_paths (member_id uuid, track_id uuid, old_key text, new_key text) ON COMMIT DROP;
INSERT INTO bvs_flac_repair_paths VALUES
    ('ba9f2b34-6740-481b-abf4-22b0668b4b22'::uuid, 'd8542ccd-845f-433f-aead-b44513823a95'::uuid, 'releases/edbe4212-b17b-49f2-81a0-340bad4d1dcd/1786747185395/track-01.flac', 'releases/edbe4212-b17b-49f2-81a0-340bad4d1dcd/1786747185395/track-01-browser-20261019.flac'),
    ('5ae572f1-6d71-4080-87cf-962d4b0319da'::uuid, '388b350e-37cb-48ab-a1b4-7131180c6468'::uuid, 'releases/edbe4212-b17b-49f2-81a0-340bad4d1dcd/1786747185395/track-02.flac', 'releases/edbe4212-b17b-49f2-81a0-340bad4d1dcd/1786747185395/track-02-browser-20261019.flac'),
    ('c217677d-d4ee-491a-b6bc-2bfa5b5f48d2'::uuid, '4897fbd1-fed6-443c-969a-969e72014581'::uuid, 'releases/edbe4212-b17b-49f2-81a0-340bad4d1dcd/1786747185395/track-03.flac', 'releases/edbe4212-b17b-49f2-81a0-340bad4d1dcd/1786747185395/track-03-browser-20261019.flac'),
    ('90704a66-d472-495b-84cf-38062df2f5d2'::uuid, '19324443-af6e-4892-9a3e-58b5cc5b3e7d'::uuid, 'releases/edbe4212-b17b-49f2-81a0-340bad4d1dcd/1786747185395/track-04.flac', 'releases/edbe4212-b17b-49f2-81a0-340bad4d1dcd/1786747185395/track-04-browser-20261019.flac'),
    ('415ddd8d-d4d9-44a2-9288-1ec564368f5a'::uuid, '68caf9f5-e765-4d13-87f9-20fbc0d1c73a'::uuid, 'releases/edbe4212-b17b-49f2-81a0-340bad4d1dcd/1786747185395/track-05.flac', 'releases/edbe4212-b17b-49f2-81a0-340bad4d1dcd/1786747185395/track-05-browser-20261019.flac'),
    ('e4e3d509-3a68-4ce1-8808-3ca56f31f485'::uuid, '08f81272-9c34-4043-a6d3-136aa768bc11'::uuid, 'releases/edbe4212-b17b-49f2-81a0-340bad4d1dcd/1786747185395/track-06.flac', 'releases/edbe4212-b17b-49f2-81a0-340bad4d1dcd/1786747185395/track-06-browser-20261019.flac'),
    ('ce14227b-920f-453b-b0f9-8f9583e0eb2f'::uuid, '69e6c9a7-b9df-42d0-ba36-a1a79cbd368f'::uuid, 'releases/edbe4212-b17b-49f2-81a0-340bad4d1dcd/1786747185395/track-07.flac', 'releases/edbe4212-b17b-49f2-81a0-340bad4d1dcd/1786747185395/track-07-browser-20261019.flac'),
    ('c160f0e4-bae5-4904-b4ee-7abe7a5ead6a'::uuid, '0e1bc754-e689-4d4c-85c9-575b71fc502f'::uuid, 'releases/edbe4212-b17b-49f2-81a0-340bad4d1dcd/1786747185395/track-08.flac', 'releases/edbe4212-b17b-49f2-81a0-340bad4d1dcd/1786747185395/track-08-browser-20261019.flac'),
    ('25623209-0111-4c0a-99ca-e81745d3d109'::uuid, '8dad6e98-7e41-4424-8440-7508d84a26eb'::uuid, 'releases/edbe4212-b17b-49f2-81a0-340bad4d1dcd/1786747185395/track-09.flac', 'releases/edbe4212-b17b-49f2-81a0-340bad4d1dcd/1786747185395/track-09-browser-20261019.flac'),
    ('2ec35a27-eaab-490c-b6b4-685acdce4483'::uuid, 'd74da302-4236-4b0e-b5fc-cc13c7ea5b94'::uuid, 'releases/edbe4212-b17b-49f2-81a0-340bad4d1dcd/1786747185395/track-10.flac', 'releases/edbe4212-b17b-49f2-81a0-340bad4d1dcd/1786747185395/track-10-browser-20261019.flac')
  ;
DO $$
DECLARE release_row public.releases%ROWTYPE; changed integer; done_count integer;
BEGIN
  SELECT * INTO STRICT release_row FROM public.releases
  WHERE id = 'fce4184e-a4e5-46d9-a9a3-f24ba4816942'
    AND is_public AND editorial_status = 'approved' AND NOT content_hold FOR UPDATE;
  SELECT count(*) INTO done_count FROM bvs_flac_repair_paths p
  JOIN public.release_tracks rt ON rt.id=p.member_id AND rt.track_id=p.track_id
  JOIN public.tracks t ON t.id=p.track_id
  WHERE rt.file_url='/api/media/'||p.new_key AND t.file_url='/api/media/'||p.new_key;
  IF done_count = 10 THEN RETURN; END IF;
  IF done_count <> 0 THEN RAISE EXCEPTION 'Partial FLAC repair requires review'; END IF;
  UPDATE public.release_tracks rt SET file_url='/api/media/'||p.new_key
  FROM bvs_flac_repair_paths p WHERE rt.id=p.member_id AND rt.track_id=p.track_id
    AND rt.release_id=release_row.id AND rt.audio_path=p.old_key
    AND rt.file_url='/api/media/'||p.old_key;
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed <> 10 THEN RAISE EXCEPTION 'Expected 10 release track updates, got %',changed; END IF;
  UPDATE public.tracks t SET file_url='/api/media/'||p.new_key
  FROM bvs_flac_repair_paths p WHERE t.id=p.track_id AND t.release_id=release_row.id
    AND t.is_public AND t.editorial_status='approved'
    AND t.file_url='/api/media/'||p.old_key;
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed <> 10 THEN RAISE EXCEPTION 'Expected 10 catalogue track updates, got %',changed; END IF;
  INSERT INTO public.editorial_audit_log(actor_id,action,entity_type,entity_id,details)
  VALUES(release_row.reviewed_by,'release_media_format_repaired','release',release_row.id,
  '{"reason":"malformed embedded FLAC picture metadata blocked browser playback","repair":"2026-10-19-freshman-flac-cutover","audio_reencoded":false,"original_objects_preserved":true}'::jsonb);
END $$;
COMMIT;
