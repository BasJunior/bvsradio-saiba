-- BVS Radio founder authority.
-- One protected Founder may exist. Founder has all administrator capabilities,
-- while keeping the public BasJunior artist identity unchanged.

ALTER TABLE public.editorial_staff
  DROP CONSTRAINT IF EXISTS editorial_staff_role_check;

ALTER TABLE public.editorial_staff
  ADD CONSTRAINT editorial_staff_role_check
  CHECK (role IN ('founder', 'administrator', 'editor', 'programmer', 'credits_editor', 'commerce_manager'));

CREATE UNIQUE INDEX IF NOT EXISTS editorial_staff_single_founder_idx
  ON public.editorial_staff (role)
  WHERE role = 'founder';

CREATE OR REPLACE FUNCTION public.is_artist_wallet_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'moderator')
  ) INTO allowed;

  IF allowed THEN
    RETURN TRUE;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.editorial_staff s
    WHERE s.user_id = auth.uid()
      AND s.active = TRUE
      AND s.role IN ('founder', 'administrator', 'commerce_manager')
  ) INTO allowed;

  RETURN COALESCE(allowed, FALSE);
END;
$$;

INSERT INTO public.editorial_staff (user_id, role, active, updated_at)
SELECT id, 'founder', TRUE, NOW()
FROM public.profiles
WHERE LOWER(username) = 'basjunior'
ON CONFLICT (user_id) DO UPDATE
SET role = 'founder', active = TRUE, updated_at = NOW();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.editorial_staff WHERE role = 'founder' AND active = TRUE) THEN
    RAISE EXCEPTION 'BasJunior profile not found; Founder authority was not assigned';
  END IF;
END;
$$;
