
-- Notification type enum
CREATE TYPE public.notification_type AS ENUM (
  'registration_success','new_event','event_reminder','attendance_verified',
  'certificate_ready','event_updated','event_cancelled',
  'new_registration','registration_cancelled','event_full',
  'attendance_submitted','certificate_generated'
);

-- Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.notification_type NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  event_name text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
-- Allow anyone signed in to insert (triggers use SECURITY DEFINER path)
CREATE POLICY "System insert notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);

-- Certificates table
CREATE TABLE public.certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_code text NOT NULL UNIQUE DEFAULT ('COVOL-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  volunteer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  organizer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_hours numeric NOT NULL DEFAULT 0,
  issued_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (volunteer_id, event_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificates TO authenticated;
GRANT ALL ON public.certificates TO service_role;

ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Volunteer reads own certs" ON public.certificates
  FOR SELECT TO authenticated USING (auth.uid() = volunteer_id);
CREATE POLICY "Organizer reads own event certs" ON public.certificates
  FOR SELECT TO authenticated USING (auth.uid() = organizer_id);
CREATE POLICY "Organizer inserts certs for attended volunteers" ON public.certificates
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = organizer_id
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND e.organizer_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.event_registrations r
      WHERE r.event_id = certificates.event_id
        AND r.volunteer_id = certificates.volunteer_id
        AND r.status = 'attended'
    )
  );
CREATE POLICY "Organizer deletes own event certs" ON public.certificates
  FOR DELETE TO authenticated USING (auth.uid() = organizer_id);

-- Trigger: event insert/update -> notify volunteers
CREATE OR REPLACE FUNCTION public.tg_events_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- New published event
  IF (TG_OP = 'INSERT' AND NEW.status = 'published') THEN
    INSERT INTO public.notifications (user_id, type, title, description, event_id, event_name)
    SELECT ur.user_id, 'new_event', 'New event published', NEW.title || ' is now open for registration.', NEW.id, NEW.title
    FROM public.user_roles ur WHERE ur.role = 'volunteer';
    RETURN NEW;
  END IF;

  IF (TG_OP = 'UPDATE') THEN
    -- Draft -> published
    IF (OLD.status <> 'published' AND NEW.status = 'published') THEN
      INSERT INTO public.notifications (user_id, type, title, description, event_id, event_name)
      SELECT ur.user_id, 'new_event', 'New event published', NEW.title || ' is now open for registration.', NEW.id, NEW.title
      FROM public.user_roles ur WHERE ur.role = 'volunteer';
    -- Cancelled
    ELSIF (OLD.status <> 'cancelled' AND NEW.status = 'cancelled') THEN
      INSERT INTO public.notifications (user_id, type, title, description, event_id, event_name)
      SELECT r.volunteer_id, 'event_cancelled', 'Event cancelled', NEW.title || ' has been cancelled.', NEW.id, NEW.title
      FROM public.event_registrations r WHERE r.event_id = NEW.id AND r.status <> 'cancelled';
    -- Updated details
    ELSIF (OLD.title IS DISTINCT FROM NEW.title
        OR OLD.start_at IS DISTINCT FROM NEW.start_at
        OR OLD.location IS DISTINCT FROM NEW.location
        OR OLD.description IS DISTINCT FROM NEW.description) THEN
      INSERT INTO public.notifications (user_id, type, title, description, event_id, event_name)
      SELECT r.volunteer_id, 'event_updated', 'Event updated', NEW.title || ' details were updated.', NEW.id, NEW.title
      FROM public.event_registrations r WHERE r.event_id = NEW.id AND r.status <> 'cancelled';
    END IF;
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER events_notify_aiu
AFTER INSERT OR UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.tg_events_notify();

-- Trigger: registration insert/update/delete
CREATE OR REPLACE FUNCTION public.tg_registrations_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ev record;
  reg_count int;
  vol_name text;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    SELECT id, title, organizer_id, capacity INTO ev FROM public.events WHERE id = NEW.event_id;
    SELECT full_name INTO vol_name FROM public.profiles WHERE id = NEW.volunteer_id;
    -- Volunteer confirmation
    INSERT INTO public.notifications (user_id, type, title, description, event_id, event_name)
    VALUES (NEW.volunteer_id, 'registration_success', 'Registration confirmed',
            'You registered for ' || ev.title || '.', ev.id, ev.title);
    -- Organizer notification
    INSERT INTO public.notifications (user_id, type, title, description, event_id, event_name)
    VALUES (ev.organizer_id, 'new_registration', 'New volunteer registered',
            COALESCE(vol_name,'A volunteer') || ' registered for ' || ev.title || '.', ev.id, ev.title);
    -- Event full check
    IF ev.capacity > 0 THEN
      SELECT count(*) INTO reg_count FROM public.event_registrations WHERE event_id = ev.id AND status <> 'cancelled';
      IF reg_count >= ev.capacity THEN
        INSERT INTO public.notifications (user_id, type, title, description, event_id, event_name)
        VALUES (ev.organizer_id, 'event_full', 'Event is full',
                ev.title || ' has reached full capacity.', ev.id, ev.title);
      END IF;
    END IF;
  ELSIF (TG_OP = 'DELETE') THEN
    SELECT id, title, organizer_id INTO ev FROM public.events WHERE id = OLD.event_id;
    SELECT full_name INTO vol_name FROM public.profiles WHERE id = OLD.volunteer_id;
    IF ev.id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, description, event_id, event_name)
      VALUES (ev.organizer_id, 'registration_cancelled', 'Registration cancelled',
              COALESCE(vol_name,'A volunteer') || ' cancelled for ' || ev.title || '.', ev.id, ev.title);
    END IF;
  ELSIF (TG_OP = 'UPDATE') THEN
    -- Attendance verified
    IF (OLD.status <> 'attended' AND NEW.status = 'attended') THEN
      SELECT id, title, organizer_id INTO ev FROM public.events WHERE id = NEW.event_id;
      SELECT full_name INTO vol_name FROM public.profiles WHERE id = NEW.volunteer_id;
      INSERT INTO public.notifications (user_id, type, title, description, event_id, event_name)
      VALUES (NEW.volunteer_id, 'attendance_verified', 'Attendance verified',
              'Your attendance for ' || ev.title || ' was verified.', ev.id, ev.title);
      INSERT INTO public.notifications (user_id, type, title, description, event_id, event_name)
      VALUES (ev.organizer_id, 'attendance_submitted', 'Attendance recorded',
              'Marked ' || COALESCE(vol_name,'a volunteer') || ' attended ' || ev.title || '.', ev.id, ev.title);
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE TRIGGER registrations_notify_aiud
AFTER INSERT OR UPDATE OR DELETE ON public.event_registrations
FOR EACH ROW EXECUTE FUNCTION public.tg_registrations_notify();

-- Trigger: certificate insert
CREATE OR REPLACE FUNCTION public.tg_certificates_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ev record;
BEGIN
  SELECT title INTO ev FROM public.events WHERE id = NEW.event_id;
  INSERT INTO public.notifications (user_id, type, title, description, event_id, event_name)
  VALUES (NEW.volunteer_id, 'certificate_ready', 'Certificate ready',
          'Your certificate for ' || ev.title || ' is ready to download.', NEW.event_id, ev.title);
  INSERT INTO public.notifications (user_id, type, title, description, event_id, event_name)
  VALUES (NEW.organizer_id, 'certificate_generated', 'Certificate generated',
          'Certificate issued for ' || ev.title || '.', NEW.event_id, ev.title);
  RETURN NEW;
END; $$;

CREATE TRIGGER certificates_notify_ai
AFTER INSERT ON public.certificates
FOR EACH ROW EXECUTE FUNCTION public.tg_certificates_notify();

-- Realtime
ALTER TABLE public.events REPLICA IDENTITY FULL;
ALTER TABLE public.event_registrations REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.certificates REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_registrations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.certificates;
