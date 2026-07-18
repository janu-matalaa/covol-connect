
-- Add certificate_type column to distinguish volunteer vs organizer certificates
DO $$ BEGIN
  CREATE TYPE public.certificate_type AS ENUM ('volunteer','organizer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS certificate_type public.certificate_type NOT NULL DEFAULT 'volunteer';

-- Allow admins to insert organizer certificates and view all certificates
DROP POLICY IF EXISTS "Admins can insert organizer certificates" ON public.certificates;
CREATE POLICY "Admins can insert organizer certificates"
  ON public.certificates FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND certificate_type = 'organizer');

DROP POLICY IF EXISTS "Admins can view all certificates" ON public.certificates;
CREATE POLICY "Admins can view all certificates"
  ON public.certificates FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
