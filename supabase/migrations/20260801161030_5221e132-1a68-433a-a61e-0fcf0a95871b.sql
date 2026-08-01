-- Promote existing user to admin
UPDATE public.user_roles SET role = 'admin'::public.app_role
WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'matalajahnavi@gmail.com');

UPDATE public.profiles SET organizer_status = 'approved'::public.organizer_status, suspended = false
WHERE email = 'matalajahnavi@gmail.com';

-- AI verification analysis reports
CREATE TABLE public.verification_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trust_score integer NOT NULL DEFAULT 0,
  risk_level text NOT NULL DEFAULT 'medium',
  recommendation text NOT NULL DEFAULT 'reject',
  reason text NOT NULL DEFAULT '',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.verification_reports TO authenticated;
GRANT ALL ON public.verification_reports TO service_role;

ALTER TABLE public.verification_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage verification reports"
  ON public.verification_reports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Organizers read own verification reports"
  ON public.verification_reports FOR SELECT TO authenticated
  USING (organizer_id = auth.uid());

CREATE TRIGGER trg_verification_reports_updated_at
  BEFORE UPDATE ON public.verification_reports
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_verification_reports_organizer ON public.verification_reports(organizer_id, created_at DESC);