-- Repair already-approved release whose catalogue inserts failed on fractional duration.
-- No new publication decision, rotation expansion, or mobile clearance is made here.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$
DECLARE r public.releases%ROWTYPE; m record; new_id uuid;
BEGIN
 SELECT * INTO STRICT r FROM public.releases
 WHERE id='507c2632-9b29-4887-9348-069aa2bb612f'
 AND is_public AND editorial_status='approved' AND NOT content_hold FOR UPDATE;
 IF r.in_rotation THEN RAISE EXCEPTION 'Unexpected rotation state; review before repair'; END IF;
 FOR m IN SELECT rt.*, probe.duration_seconds FROM public.release_tracks rt
 LEFT JOIN LATERAL (
   SELECT j.duration_seconds FROM public.media_processing_jobs j
   WHERE j.release_track_id=rt.id AND j.release_id=r.id AND j.status='ready'
   AND j.source_path=rt.audio_path AND j.duration_seconds>0
   ORDER BY j.completed_at DESC LIMIT 1
 ) probe ON true
 WHERE rt.release_id=r.id AND rt.track_id IS NULL ORDER BY rt.position
 LOOP
   IF m.duration_seconds IS NULL THEN RAISE EXCEPTION 'Missing verified probe for %',m.id; END IF;
   IF EXISTS(SELECT 1 FROM public.tracks WHERE release_id=r.id AND track_number=m.position)
   THEN RAISE EXCEPTION 'Existing unlinked catalogue track for %',m.id; END IF;
   INSERT INTO public.tracks(user_id,title,artist_name,genre,description,file_url,duration_sec,
     artwork_url,is_public,editorial_status,in_rotation,explicit_content,reviewed_by,reviewed_at,
     release_id,track_number,licence_type,download_price,is_downloadable)
   VALUES(r.user_id,m.title,r.artist_name,coalesce(r.genre,'Other'),coalesce(r.description,''),
     m.file_url,m.duration_seconds,r.cover_url,true,'approved',false,r.explicit_content,r.reviewed_by,r.reviewed_at,
     r.id,m.position,'personal_download',2,true) RETURNING id INTO new_id;
   UPDATE public.release_tracks SET track_id=new_id WHERE id=m.id;
 END LOOP;
 INSERT INTO public.editorial_audit_log(actor_id,action,entity_type,entity_id,details)
 VALUES(r.reviewed_by,'release_catalogue_repaired','release',r.id,
 '{"reason":"fractional duration insert failures; restored approved release catalogue","repair":"2026-10-19-cloudebeats-catalogue","rotation_changed":false}'::jsonb);
END $$;
COMMIT;
