-- BVS Apple-compliance pack: versioned rights attestation, clearance evidence,
-- public copyright complaints/takedowns, and repeat-infringer enforcement.
-- Idempotent. Safe to re-run in Supabase SQL Editor.
-- Does NOT auto-delete content or accounts. No invented legal claims.
-- Depends on: releases, release_tracks, tracks, profiles, editorial_staff, rights-passport.

-- ---------------------------------------------------------------------------
-- 0) Release material flags (artist-declared third-party / derivative signals)
-- ---------------------------------------------------------------------------
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS contains_cover BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS contains_remix BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS contains_samples BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS contains_leased_beats BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS contains_third_party BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS rights_attestation_id UUID;
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS rights_agreement_version TEXT;
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS rights_attested_at TIMESTAMPTZ;
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS content_hold BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS content_hold_reason TEXT;
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS content_hold_at TIMESTAMPTZ;
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS content_hold_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS content_hold BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS content_hold_reason TEXT;
ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS content_hold_at TIMESTAMPTZ;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rights_upload_restricted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rights_publish_restricted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rights_restriction_reason TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rights_restriction_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rights_restriction_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_copyright_strikes INT NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- 1) Versioned rights agreement text (staff-seeded; app code also has constant)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rights_agreement_versions (
  version TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  body_markdown TEXT NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retired_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.rights_agreement_versions (version, title, summary, body_markdown, effective_at, active)
VALUES (
  'BVS-RIGHTS-ATTEST-2026-08-01',
  'BVS Release Rights Attestation (2026-08-01)',
  'Artist confirms master/composition control, featured contributors, samples/beats clearance, and grants BVS limited host/stream/catalogue/promote rights for this release.',
  $md$
# BVS Release Rights Attestation

**Version:** BVS-RIGHTS-ATTEST-2026-08-01
**Effective:** 1 August 2026

By submitting this attestation for a specific release, you confirm that:

1. **Master control** — You own or control the sound recording (master) rights needed for BVS to host and stream the audio on this release, or you have written authority from the rights holder(s).
2. **Composition control** — You own or control the underlying musical work / composition rights needed for the same uses, or you have written authority from the songwriter(s)/publisher(s).
3. **Featured contributors** — Every featured artist, vocalist, and credited collaborator has granted permission for their contribution to appear on BVS.
4. **Samples, covers, remixes, and leased beats** — Any third-party material is either original to you, licensed, or supported by clearance evidence you attach in the clearance section. You will not publish uncleared third-party material.
5. **Grant to BVS** — You grant Best Virtual Studios / BVS Radio a non-exclusive, worldwide licence to **host**, **stream**, list in the **catalogue**, and **promote** this release on BVS properties for as long as the release remains on the platform (subject to takedown, hold, or removal workflows). This grant does **not** transfer copyright ownership to BVS.
6. **Accuracy** — The information and declarations you provide are true and complete to the best of your knowledge.

**Lawyer review:** This text is an operational placeholder describing product behaviour. It is **not** a substitute for jurisdiction-specific legal advice. Marked for lawyer review before treating as final counsel-approved terms.
$md$,
  '2026-08-01T00:00:00Z',
  TRUE
)
ON CONFLICT (version) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  body_markdown = EXCLUDED.body_markdown,
  active = EXCLUDED.active;

-- ---------------------------------------------------------------------------
-- 2) Immutable release-specific rights attestations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.release_rights_attestations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID NOT NULL REFERENCES public.releases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agreement_version TEXT NOT NULL REFERENCES public.rights_agreement_versions(version),
  attested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  master_control BOOLEAN NOT NULL,
  composition_control BOOLEAN NOT NULL,
  featured_contributors_cleared BOOLEAN NOT NULL,
  samples_beats_cleared BOOLEAN NOT NULL,
  grant_host BOOLEAN NOT NULL,
  grant_stream BOOLEAN NOT NULL,
  grant_catalogue BOOLEAN NOT NULL,
  grant_promote BOOLEAN NOT NULL,
  accuracy_confirmed BOOLEAN NOT NULL DEFAULT TRUE,
  track_ids UUID[] NOT NULL DEFAULT '{}',
  release_track_ids UUID[] NOT NULL DEFAULT '{}',
  snapshot JSONB NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS release_rights_attestations_release_idx
  ON public.release_rights_attestations(release_id, attested_at DESC);
CREATE INDEX IF NOT EXISTS release_rights_attestations_user_idx
  ON public.release_rights_attestations(user_id, attested_at DESC);
CREATE INDEX IF NOT EXISTS release_rights_attestations_version_idx
  ON public.release_rights_attestations(agreement_version);

-- Immutability: no update/delete of attestation rows
CREATE OR REPLACE FUNCTION public.prevent_release_rights_attestation_mutation()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'RELEASE_RIGHTS_ATTESTATION_IMMUTABLE';
END;
$$;

DROP TRIGGER IF EXISTS release_rights_attestations_no_update ON public.release_rights_attestations;
CREATE TRIGGER release_rights_attestations_no_update
  BEFORE UPDATE ON public.release_rights_attestations
  FOR EACH ROW EXECUTE PROCEDURE public.prevent_release_rights_attestation_mutation();

DROP TRIGGER IF EXISTS release_rights_attestations_no_delete ON public.release_rights_attestations;
CREATE TRIGGER release_rights_attestations_no_delete
  BEFORE DELETE ON public.release_rights_attestations
  FOR EACH ROW EXECUTE PROCEDURE public.prevent_release_rights_attestation_mutation();

-- ---------------------------------------------------------------------------
-- 3) Structured clearance evidence
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.release_clearance_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID NOT NULL REFERENCES public.releases(id) ON DELETE CASCADE,
  release_track_id UUID REFERENCES public.release_tracks(id) ON DELETE SET NULL,
  track_id UUID REFERENCES public.tracks(id) ON DELETE SET NULL,
  material_type TEXT NOT NULL CHECK (material_type IN (
    'cover', 'remix', 'sample', 'leased_beat', 'third_party', 'other'
  )),
  risk_level TEXT NOT NULL DEFAULT 'medium' CHECK (risk_level IN (
    'low', 'medium', 'high', 'critical'
  )),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  rights_holder_name TEXT,
  licence_or_permission_ref TEXT,
  source_url TEXT,
  document_storage_path TEXT,
  document_filename TEXT,
  document_content_type TEXT,
  document_byte_size BIGINT,
  document_sha256 TEXT,
  required BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN (
    'draft', 'submitted', 'accepted', 'rejected', 'waived_by_staff'
  )),
  staff_notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS release_clearance_items_release_idx
  ON public.release_clearance_items(release_id, material_type, status);
CREATE INDEX IF NOT EXISTS release_clearance_items_required_idx
  ON public.release_clearance_items(release_id, required, status);

-- ---------------------------------------------------------------------------
-- 4) Public copyright complaints / takedown dockets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.copyright_complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  docket_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN (
    'received',
    'under_review',
    'hold_applied',
    'resolved_upheld',
    'resolved_rejected',
    'withdrawn',
    'counter_notice_received'
  )),
  claimant_name TEXT NOT NULL,
  claimant_email TEXT NOT NULL,
  claimant_organization TEXT,
  claimant_address TEXT,
  contact_phone TEXT,
  work_title TEXT NOT NULL,
  work_description TEXT NOT NULL DEFAULT '',
  original_work_urls TEXT[] NOT NULL DEFAULT '{}',
  allegedly_infringing_urls TEXT[] NOT NULL DEFAULT '{}',
  release_id UUID REFERENCES public.releases(id) ON DELETE SET NULL,
  track_id UUID REFERENCES public.tracks(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  good_faith_declaration BOOLEAN NOT NULL,
  accuracy_declaration BOOLEAN NOT NULL,
  authority_declaration BOOLEAN NOT NULL,
  signature_name TEXT NOT NULL,
  statement TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  staff_notes TEXT,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_summary TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  hold_applied_at TIMESTAMPTZ,
  hold_applied_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS copyright_complaints_status_idx
  ON public.copyright_complaints(status, created_at DESC);
CREATE INDEX IF NOT EXISTS copyright_complaints_target_idx
  ON public.copyright_complaints(target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS copyright_complaints_release_idx
  ON public.copyright_complaints(release_id);

CREATE TABLE IF NOT EXISTS public.copyright_complaint_events (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  complaint_id UUID NOT NULL REFERENCES public.copyright_complaints(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('public', 'staff', 'system', 'artist')),
  event_type TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS copyright_complaint_events_complaint_idx
  ON public.copyright_complaint_events(complaint_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.copyright_counter_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES public.copyright_complaints(id) ON DELETE CASCADE,
  artist_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_email TEXT NOT NULL,
  statement TEXT NOT NULL,
  good_faith_declaration BOOLEAN NOT NULL,
  signature_name TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS copyright_counter_notices_complaint_idx
  ON public.copyright_counter_notices(complaint_id, submitted_at DESC);

CREATE TABLE IF NOT EXISTS public.artist_rights_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  complaint_id UUID REFERENCES public.copyright_complaints(id) ON DELETE SET NULL,
  notice_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS artist_rights_notices_user_idx
  ON public.artist_rights_notices(user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 5) Repeat-infringer policy settings + strikes (no auto-delete)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.copyright_policy_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  strike_threshold INT NOT NULL DEFAULT 3 CHECK (strike_threshold BETWEEN 1 AND 20),
  account_restriction_threshold INT NOT NULL DEFAULT 3 CHECK (account_restriction_threshold BETWEEN 1 AND 20),
  release_hold_on_upheld BOOLEAN NOT NULL DEFAULT TRUE,
  restrict_uploads_at_threshold BOOLEAN NOT NULL DEFAULT TRUE,
  restrict_publish_at_threshold BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT NOT NULL DEFAULT 'Operational defaults. Lawyer review before treating thresholds as final policy.',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO public.copyright_policy_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.copyright_strikes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  complaint_id UUID REFERENCES public.copyright_complaints(id) ON DELETE SET NULL,
  release_id UUID REFERENCES public.releases(id) ON DELETE SET NULL,
  track_id UUID REFERENCES public.tracks(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deactivated_at TIMESTAMPTZ,
  deactivated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deactivation_reason TEXT
);

CREATE INDEX IF NOT EXISTS copyright_strikes_user_active_idx
  ON public.copyright_strikes(user_id, active, created_at DESC);

CREATE TABLE IF NOT EXISTS public.account_rights_restrictions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  upload_restricted BOOLEAN NOT NULL DEFAULT FALSE,
  publish_restricted BOOLEAN NOT NULL DEFAULT FALSE,
  reason TEXT,
  strike_count_snapshot INT NOT NULL DEFAULT 0,
  set_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  set_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  override_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  override_reason TEXT,
  override_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 6) RLS: service role for server APIs; limited self-read where useful
-- ---------------------------------------------------------------------------
ALTER TABLE public.rights_agreement_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_rights_attestations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_clearance_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copyright_complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copyright_complaint_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copyright_counter_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artist_rights_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copyright_policy_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copyright_strikes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_rights_restrictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read active rights agreements" ON public.rights_agreement_versions;
CREATE POLICY "public read active rights agreements" ON public.rights_agreement_versions
  FOR SELECT USING (active = TRUE);

DROP POLICY IF EXISTS "artists read own release attestations" ON public.release_rights_attestations;
CREATE POLICY "artists read own release attestations" ON public.release_rights_attestations
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "artists manage own clearance items" ON public.release_clearance_items;
CREATE POLICY "artists manage own clearance items" ON public.release_clearance_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.releases r WHERE r.id = release_id AND r.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.releases r WHERE r.id = release_id AND r.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "artists read own rights notices" ON public.artist_rights_notices;
CREATE POLICY "artists read own rights notices" ON public.artist_rights_notices
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "artists read own counter notices" ON public.copyright_counter_notices;
CREATE POLICY "artists read own counter notices" ON public.copyright_counter_notices
  FOR SELECT USING (artist_user_id = auth.uid());

DROP POLICY IF EXISTS "artists read own strikes" ON public.copyright_strikes;
CREATE POLICY "artists read own strikes" ON public.copyright_strikes
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "artists read own restrictions" ON public.account_rights_restrictions;
CREATE POLICY "artists read own restrictions" ON public.account_rights_restrictions
  FOR SELECT USING (user_id = auth.uid());

-- Complaints: no public SELECT via RLS (docket returned only by server after submit).
-- Staff access is via service role in Next.js APIs.

-- ---------------------------------------------------------------------------
-- 7) Preflight: versioned attestation + clearance evidence gates
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_release_preflight(p_release_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.releases%rowtype;
  blockers jsonb := '[]'::jsonb;
  track_total integer;
  active_version text;
  has_attestation boolean;
  needs_clearance boolean;
  missing_clearance boolean;
  restricted boolean;
BEGIN
  SELECT * INTO r FROM public.releases WHERE id = p_release_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'RELEASE_NOT_FOUND'; END IF;

  SELECT count(*) INTO track_total FROM public.release_tracks WHERE release_id = p_release_id;
  IF trim(coalesce(r.title, '')) = '' THEN blockers := blockers || '"RELEASE_TITLE_REQUIRED"'::jsonb; END IF;
  IF trim(coalesce(r.genre, '')) = '' THEN blockers := blockers || '"GENRE_REQUIRED"'::jsonb; END IF;
  IF track_total < 1 THEN blockers := blockers || '"AUDIO_TRACK_REQUIRED"'::jsonb; END IF;
  IF r.cover_url IS NULL OR r.cover_url = '' OR r.cover_url LIKE '%default-artwork%' THEN
    blockers := blockers || '"COVER_ART_REQUIRED"'::jsonb;
  END IF;
  IF NOT r.rights_confirmed THEN blockers := blockers || '"RIGHTS_ATTESTATION_REQUIRED"'::jsonb; END IF;
  IF NOT r.explicit_declared THEN blockers := blockers || '"EXPLICIT_STATUS_DECLARATION_REQUIRED"'::jsonb; END IF;
  IF r.copyright_year IS NULL OR r.copyright_year < 1900 OR r.copyright_year > extract(year FROM now())::integer + 1 THEN
    blockers := blockers || '"VALID_COPYRIGHT_YEAR_REQUIRED"'::jsonb;
  END IF;
  IF trim(coalesce(r.master_owner_name, '')) = '' THEN blockers := blockers || '"MASTER_OWNER_REQUIRED"'::jsonb; END IF;
  IF cardinality(r.composition_owner_names) = 0 THEN blockers := blockers || '"COMPOSITION_OWNER_REQUIRED"'::jsonb; END IF;
  IF cardinality(r.territories) = 0 THEN blockers := blockers || '"TERRITORY_REQUIRED"'::jsonb; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.release_contributors
    WHERE release_id = p_release_id AND contribution_role = 'primary_artist' AND rights_confirmed
  ) THEN blockers := blockers || '"PRIMARY_ARTIST_CONFIRMATION_REQUIRED"'::jsonb; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.release_contributors
    WHERE release_id = p_release_id AND contribution_role IN ('songwriter', 'composer') AND rights_confirmed
  ) THEN blockers := blockers || '"SONGWRITER_CONFIRMATION_REQUIRED"'::jsonb; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.release_contributors
    WHERE release_id = p_release_id AND contribution_role = 'producer' AND rights_confirmed
  ) THEN blockers := blockers || '"PRODUCER_CONFIRMATION_REQUIRED"'::jsonb; END IF;
  IF EXISTS (
    SELECT 1 FROM public.release_contributors
    WHERE release_id = p_release_id AND NOT rights_confirmed
  ) THEN blockers := blockers || '"CONTRIBUTOR_PERMISSION_REQUIRED"'::jsonb; END IF;

  -- Versioned rights attestation (Apple-compliance)
  SELECT version INTO active_version
  FROM public.rights_agreement_versions
  WHERE active = TRUE
  ORDER BY effective_at DESC
  LIMIT 1;

  IF active_version IS NULL THEN
    blockers := blockers || '"RIGHTS_AGREEMENT_VERSION_MISSING"'::jsonb;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.release_rights_attestations a
      WHERE a.release_id = p_release_id
        AND a.agreement_version = active_version
        AND a.master_control
        AND a.composition_control
        AND a.featured_contributors_cleared
        AND a.samples_beats_cleared
        AND a.grant_host AND a.grant_stream AND a.grant_catalogue AND a.grant_promote
        AND a.accuracy_confirmed
    ) INTO has_attestation;
    IF NOT has_attestation THEN
      blockers := blockers || '"VERSIONED_RIGHTS_ATTESTATION_REQUIRED"'::jsonb;
    END IF;
  END IF;

  needs_clearance :=
    coalesce(r.contains_cover, FALSE)
    OR coalesce(r.contains_remix, FALSE)
    OR coalesce(r.contains_samples, FALSE)
    OR coalesce(r.contains_leased_beats, FALSE)
    OR coalesce(r.contains_third_party, FALSE);

  IF needs_clearance THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.release_clearance_items c
      WHERE c.release_id = p_release_id
        AND c.required = TRUE
        AND c.status NOT IN ('submitted', 'accepted', 'waived_by_staff')
    ) OR NOT EXISTS (
      SELECT 1 FROM public.release_clearance_items c
      WHERE c.release_id = p_release_id AND c.required = TRUE
        AND c.status IN ('submitted', 'accepted', 'waived_by_staff')
        AND (
          (coalesce(r.contains_cover, FALSE) AND c.material_type = 'cover')
          OR (coalesce(r.contains_remix, FALSE) AND c.material_type = 'remix')
          OR (coalesce(r.contains_samples, FALSE) AND c.material_type = 'sample')
          OR (coalesce(r.contains_leased_beats, FALSE) AND c.material_type = 'leased_beat')
          OR (coalesce(r.contains_third_party, FALSE) AND c.material_type IN ('third_party', 'cover', 'remix', 'sample', 'leased_beat', 'other'))
        )
    ) INTO missing_clearance;

    -- Simpler deterministic check: for each flagged type, require at least one qualifying item
    IF coalesce(r.contains_cover, FALSE) AND NOT EXISTS (
      SELECT 1 FROM public.release_clearance_items c
      WHERE c.release_id = p_release_id AND c.material_type = 'cover'
        AND c.required = TRUE AND c.status IN ('submitted', 'accepted', 'waived_by_staff')
        AND (c.document_storage_path IS NOT NULL OR coalesce(trim(c.licence_or_permission_ref), '') <> '')
    ) THEN blockers := blockers || '"CLEARANCE_COVER_EVIDENCE_REQUIRED"'::jsonb; END IF;

    IF coalesce(r.contains_remix, FALSE) AND NOT EXISTS (
      SELECT 1 FROM public.release_clearance_items c
      WHERE c.release_id = p_release_id AND c.material_type = 'remix'
        AND c.required = TRUE AND c.status IN ('submitted', 'accepted', 'waived_by_staff')
        AND (c.document_storage_path IS NOT NULL OR coalesce(trim(c.licence_or_permission_ref), '') <> '')
    ) THEN blockers := blockers || '"CLEARANCE_REMIX_EVIDENCE_REQUIRED"'::jsonb; END IF;

    IF coalesce(r.contains_samples, FALSE) AND NOT EXISTS (
      SELECT 1 FROM public.release_clearance_items c
      WHERE c.release_id = p_release_id AND c.material_type = 'sample'
        AND c.required = TRUE AND c.status IN ('submitted', 'accepted', 'waived_by_staff')
        AND (c.document_storage_path IS NOT NULL OR coalesce(trim(c.licence_or_permission_ref), '') <> '')
    ) THEN blockers := blockers || '"CLEARANCE_SAMPLE_EVIDENCE_REQUIRED"'::jsonb; END IF;

    IF coalesce(r.contains_leased_beats, FALSE) AND NOT EXISTS (
      SELECT 1 FROM public.release_clearance_items c
      WHERE c.release_id = p_release_id AND c.material_type = 'leased_beat'
        AND c.required = TRUE AND c.status IN ('submitted', 'accepted', 'waived_by_staff')
        AND (c.document_storage_path IS NOT NULL OR coalesce(trim(c.licence_or_permission_ref), '') <> '')
    ) THEN blockers := blockers || '"CLEARANCE_LEASED_BEAT_EVIDENCE_REQUIRED"'::jsonb; END IF;

    IF coalesce(r.contains_third_party, FALSE) AND NOT EXISTS (
      SELECT 1 FROM public.release_clearance_items c
      WHERE c.release_id = p_release_id AND c.material_type = 'third_party'
        AND c.required = TRUE AND c.status IN ('submitted', 'accepted', 'waived_by_staff')
        AND (c.document_storage_path IS NOT NULL OR coalesce(trim(c.licence_or_permission_ref), '') <> '')
    ) THEN blockers := blockers || '"CLEARANCE_THIRD_PARTY_EVIDENCE_REQUIRED"'::jsonb; END IF;
  END IF;

  IF coalesce(r.content_hold, FALSE) THEN
    blockers := blockers || '"CONTENT_HOLD_ACTIVE"'::jsonb;
  END IF;

  SELECT coalesce(p.rights_publish_restricted, FALSE) OR coalesce(arr.publish_restricted, FALSE)
  INTO restricted
  FROM public.profiles p
  LEFT JOIN public.account_rights_restrictions arr ON arr.user_id = p.id
  WHERE p.id = r.user_id;

  IF coalesce(restricted, FALSE) THEN
    blockers := blockers || '"ACCOUNT_PUBLISH_RESTRICTED"'::jsonb;
  END IF;

  UPDATE public.releases SET
    preflight_status = CASE WHEN jsonb_array_length(blockers) = 0 THEN 'ready' ELSE 'needs_information' END,
    preflight_blockers = blockers,
    preflight_checked_at = now(),
    updated_at = now()
  WHERE id = p_release_id;

  RETURN jsonb_build_object(
    'status', CASE WHEN jsonb_array_length(blockers) = 0 THEN 'ready' ELSE 'needs_information' END,
    'blockers', blockers
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_release_publishable(p_release_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.releases%rowtype;
  result jsonb;
BEGIN
  SELECT * INTO r FROM public.releases WHERE id = p_release_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'RELEASE_NOT_FOUND'; END IF;
  IF r.passport_version = 0 AND r.preflight_status = 'legacy_approved' THEN
    RETURN jsonb_build_object('status', 'legacy_approved', 'blockers', '[]'::jsonb);
  END IF;
  result := public.refresh_release_preflight(p_release_id);
  IF result->>'status' <> 'ready' THEN
    RAISE EXCEPTION 'RELEASE_PREFLIGHT_BLOCKED:%', result->'blockers';
  END IF;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_release_preflight(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_release_publishable(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_release_preflight(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.assert_release_publishable(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 8) Helper: recount active strikes onto profile
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_profile_copyright_strikes(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  SELECT count(*)::integer INTO n
  FROM public.copyright_strikes
  WHERE user_id = p_user_id AND active = TRUE;

  UPDATE public.profiles
  SET active_copyright_strikes = n
  WHERE id = p_user_id;

  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_profile_copyright_strikes(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_profile_copyright_strikes(uuid) TO service_role;
