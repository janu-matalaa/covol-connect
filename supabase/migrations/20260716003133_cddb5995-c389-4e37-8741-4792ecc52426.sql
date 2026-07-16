
-- Profile columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS organizer_status public.organizer_status,
  ADD COLUMN IF NOT EXISTS organization_name text,
  ADD COLUMN IF NOT EXISTS institution text,
  ADD COLUMN IF NOT EXISTS purpose text,
  ADD COLUMN IF NOT EXISTS faculty_advisor text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS suspended boolean NOT NULL DEFAULT false;

ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS revoked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_reason text;

-- Chat tables
CREATE TABLE IF NOT EXISTS public.admin_chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.admin_chat_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  attachment_url text,
  attachment_name text,
  read_by jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_chat_messages_thread ON public.admin_chat_messages(thread_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_chat_threads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_chat_messages TO authenticated;
GRANT ALL ON public.admin_chat_threads TO service_role;
GRANT ALL ON public.admin_chat_messages TO service_role;

ALTER TABLE public.admin_chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_or_admin_can_view_thread" ON public.admin_chat_threads;
CREATE POLICY "org_or_admin_can_view_thread" ON public.admin_chat_threads
  FOR SELECT TO authenticated
  USING (organizer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "org_can_create_own_thread" ON public.admin_chat_threads;
CREATE POLICY "org_can_create_own_thread" ON public.admin_chat_threads
  FOR INSERT TO authenticated
  WITH CHECK (organizer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admin_can_update_thread" ON public.admin_chat_threads;
CREATE POLICY "admin_can_update_thread" ON public.admin_chat_threads
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "participants_can_view_messages" ON public.admin_chat_messages;
CREATE POLICY "participants_can_view_messages" ON public.admin_chat_messages
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.admin_chat_threads t WHERE t.id = thread_id AND t.organizer_id = auth.uid())
  );

DROP POLICY IF EXISTS "participants_can_send_messages" ON public.admin_chat_messages;
CREATE POLICY "participants_can_send_messages" ON public.admin_chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (SELECT 1 FROM public.admin_chat_threads t WHERE t.id = thread_id AND t.organizer_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "participants_can_update_messages" ON public.admin_chat_messages;
CREATE POLICY "participants_can_update_messages" ON public.admin_chat_messages
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.admin_chat_threads t WHERE t.id = thread_id AND t.organizer_id = auth.uid())
  );

-- Helper
CREATE OR REPLACE FUNCTION public.is_approved_organizer(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _user_id
      AND coalesce(p.organizer_status, 'approved'::public.organizer_status) = 'approved'::public.organizer_status
      AND coalesce(p.suspended, false) = false
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_approved_organizer(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_approved_organizer(uuid) TO authenticated;

-- Updated new-user handler
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  chosen_role public.app_role;
BEGIN
  chosen_role := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'role','')::public.app_role,
    'volunteer'::public.app_role
  );

  IF chosen_role = 'admin'::public.app_role THEN
    chosen_role := 'volunteer'::public.app_role;
  END IF;

  INSERT INTO public.profiles (id, full_name, email, organizer_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    CASE WHEN chosen_role = 'organizer'::public.app_role
         THEN 'pending'::public.organizer_status ELSE NULL END
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, chosen_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF chosen_role = 'organizer'::public.app_role THEN
    INSERT INTO public.admin_chat_threads (organizer_id) VALUES (NEW.id)
      ON CONFLICT (organizer_id) DO NOTHING;
    INSERT INTO public.notifications (user_id, type, title, description)
    SELECT ur.user_id, 'admin_new_organizer'::public.notification_type,
           'New organizer registered',
           COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email) || ' is awaiting approval.'
    FROM public.user_roles ur
    WHERE ur.role = 'admin'::public.app_role;
  END IF;

  RETURN NEW;
END;
$$;

-- Status-change notifications
CREATE OR REPLACE FUNCTION public.tg_profiles_status_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.organizer_status IS DISTINCT FROM OLD.organizer_status AND NEW.organizer_status IS NOT NULL THEN
    IF NEW.organizer_status = 'approved'::public.organizer_status THEN
      INSERT INTO public.notifications (user_id, type, title, description)
      VALUES (NEW.id, 'organizer_approved'::public.notification_type,
              'Organizer approved', 'You now have full organizer access.');
    ELSIF NEW.organizer_status = 'rejected'::public.organizer_status THEN
      INSERT INTO public.notifications (user_id, type, title, description)
      VALUES (NEW.id, 'organizer_rejected'::public.notification_type,
              'Organizer application rejected', 'Your organizer request was rejected.');
    ELSIF NEW.organizer_status = 'more_info'::public.organizer_status THEN
      INSERT INTO public.notifications (user_id, type, title, description)
      VALUES (NEW.id, 'organizer_more_info'::public.notification_type,
              'More information needed', 'An admin has requested more information.');
    ELSIF NEW.organizer_status = 'suspended'::public.organizer_status THEN
      INSERT INTO public.notifications (user_id, type, title, description)
      VALUES (NEW.id, 'organizer_suspended'::public.notification_type,
              'Organizer suspended', 'Your organizer account has been suspended.');
    END IF;
  END IF;
  IF NEW.suspended IS DISTINCT FROM OLD.suspended AND NEW.suspended = true THEN
    INSERT INTO public.notifications (user_id, type, title, description)
    VALUES (NEW.id, 'account_suspended'::public.notification_type,
            'Account suspended', 'Your account has been suspended by an admin.');
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.tg_profiles_status_notify() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_status_notify ON public.profiles;
CREATE TRIGGER profiles_status_notify AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_profiles_status_notify();

-- Admin chat message notifications
CREATE OR REPLACE FUNCTION public.tg_admin_chat_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  org_id uuid;
  sender_name text;
BEGIN
  SELECT organizer_id INTO org_id FROM public.admin_chat_threads WHERE id = NEW.thread_id;
  SELECT full_name INTO sender_name FROM public.profiles WHERE id = NEW.sender_id;
  IF NEW.sender_id = org_id THEN
    INSERT INTO public.notifications (user_id, type, title, description)
    SELECT ur.user_id, 'admin_chat_message'::public.notification_type,
           'Verification message',
           COALESCE(sender_name,'Organizer') || ': ' || left(NEW.body, 140)
    FROM public.user_roles ur WHERE ur.role = 'admin'::public.app_role;
  ELSE
    INSERT INTO public.notifications (user_id, type, title, description)
    VALUES (org_id, 'admin_chat_message'::public.notification_type,
            'Admin message',
            COALESCE(sender_name,'Admin') || ': ' || left(NEW.body, 140));
  END IF;
  UPDATE public.admin_chat_threads SET updated_at = now() WHERE id = NEW.thread_id;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.tg_admin_chat_notify() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS admin_chat_notify ON public.admin_chat_messages;
CREATE TRIGGER admin_chat_notify AFTER INSERT ON public.admin_chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_admin_chat_notify();

-- Admin notifications on new events / certificates
CREATE OR REPLACE FUNCTION public.tg_events_admin_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, description, event_id, event_name)
  SELECT ur.user_id, 'admin_new_event'::public.notification_type,
         'New event created', NEW.title, NEW.id, NEW.title
  FROM public.user_roles ur WHERE ur.role = 'admin'::public.app_role;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.tg_events_admin_notify() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS events_admin_notify ON public.events;
CREATE TRIGGER events_admin_notify AFTER INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.tg_events_admin_notify();

CREATE OR REPLACE FUNCTION public.tg_certificates_admin_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ev record;
BEGIN
  SELECT title INTO ev FROM public.events WHERE id = NEW.event_id;
  INSERT INTO public.notifications (user_id, type, title, description, event_id, event_name)
  SELECT ur.user_id, 'admin_new_certificate'::public.notification_type,
         'Certificate issued',
         'Certificate ' || NEW.certificate_code || ' issued for ' || COALESCE(ev.title,'event'),
         NEW.event_id, ev.title
  FROM public.user_roles ur WHERE ur.role = 'admin'::public.app_role;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.tg_certificates_admin_notify() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS certificates_admin_notify ON public.certificates;
CREATE TRIGGER certificates_admin_notify AFTER INSERT ON public.certificates
  FOR EACH ROW EXECUTE FUNCTION public.tg_certificates_admin_notify();

-- Admin overrides
DROP POLICY IF EXISTS "admin_all_profiles" ON public.profiles;
CREATE POLICY "admin_all_profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admin_all_user_roles" ON public.user_roles;
CREATE POLICY "admin_all_user_roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admin_all_events" ON public.events;
CREATE POLICY "admin_all_events" ON public.events
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admin_all_registrations" ON public.event_registrations;
CREATE POLICY "admin_all_registrations" ON public.event_registrations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admin_all_certificates" ON public.certificates;
CREATE POLICY "admin_all_certificates" ON public.certificates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Approved-organizer gating on write
DROP POLICY IF EXISTS "approved_organizer_can_insert_events" ON public.events;
CREATE POLICY "approved_organizer_can_insert_events" ON public.events
  FOR INSERT TO authenticated
  WITH CHECK (
    organizer_id = auth.uid()
    AND public.has_role(auth.uid(), 'organizer'::public.app_role)
    AND public.is_approved_organizer(auth.uid())
  );
DROP POLICY IF EXISTS "approved_organizer_can_update_events" ON public.events;
CREATE POLICY "approved_organizer_can_update_events" ON public.events
  FOR UPDATE TO authenticated
  USING (organizer_id = auth.uid() AND public.is_approved_organizer(auth.uid()));
DROP POLICY IF EXISTS "approved_organizer_can_delete_events" ON public.events;
CREATE POLICY "approved_organizer_can_delete_events" ON public.events
  FOR DELETE TO authenticated
  USING (organizer_id = auth.uid() AND public.is_approved_organizer(auth.uid()));

DROP POLICY IF EXISTS "approved_organizer_can_insert_certificates" ON public.certificates;
CREATE POLICY "approved_organizer_can_insert_certificates" ON public.certificates
  FOR INSERT TO authenticated
  WITH CHECK (organizer_id = auth.uid() AND public.is_approved_organizer(auth.uid()));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_chat_threads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_chat_messages;
