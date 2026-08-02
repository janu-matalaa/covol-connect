-- 1. Approval must be explicit
CREATE OR REPLACE FUNCTION public.is_approved_organizer(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _user_id
      AND p.organizer_status = 'approved'::public.organizer_status
      AND coalesce(p.suspended, false) = false
  );
$$;

-- 2. Helper for relationship-scoped profile visibility
CREATE OR REPLACE FUNCTION public.shares_event_with(_viewer uuid, _target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events e
    JOIN public.event_registrations r ON r.event_id = e.id
    WHERE (e.organizer_id = _viewer AND r.volunteer_id = _target)
       OR (e.organizer_id = _target AND r.volunteer_id = _viewer)
  ) OR EXISTS (
    SELECT 1
    FROM public.event_registrations a
    JOIN public.event_registrations b ON b.event_id = a.event_id
    WHERE a.volunteer_id = _viewer AND b.volunteer_id = _target
  ) OR EXISTS (
    SELECT 1 FROM public.certificates c
    WHERE (c.volunteer_id = _viewer AND c.organizer_id = _target)
       OR (c.organizer_id = _viewer AND c.volunteer_id = _target)
  );
$$;

-- 3. Replace the blanket profile read policy
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid());

CREATE POLICY "Users can view profiles of people they share an event with"
ON public.profiles FOR SELECT TO authenticated
USING (public.shares_event_with(auth.uid(), id));

-- 4. Lock down direct API execution of internal functions
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_admin_chat_notify() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_certificates_admin_notify() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_certificates_notify() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_events_admin_notify() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_events_notify() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_messages_notify() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_profiles_status_notify() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_registrations_notify() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public."current_role"() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_approved_organizer(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.shares_event_with(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public."current_role"() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_approved_organizer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_event_with(uuid, uuid) TO authenticated;