
-- Add new notification types
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'organizer_announcement';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'new_message';

-- Registration details columns
ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS student_id TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS year_of_study TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS college TEXT;

-- Messages table for organizer<->volunteer communication (per event)
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  is_announcement BOOLEAN NOT NULL DEFAULT false,
  read_by JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Read policies: organizer of the event OR volunteer registered to event
CREATE POLICY "Event participants can read messages"
ON public.messages FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.organizer_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.event_registrations r WHERE r.event_id = messages.event_id AND r.volunteer_id = auth.uid())
);

-- Insert: sender must be self AND be organizer OR registered volunteer
CREATE POLICY "Participants can send messages"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.organizer_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.event_registrations r WHERE r.event_id = messages.event_id AND r.volunteer_id = auth.uid())
  )
);

-- Update read tracking (any participant can mark own read status)
CREATE POLICY "Participants can update messages read"
ON public.messages FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.organizer_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.event_registrations r WHERE r.event_id = messages.event_id AND r.volunteer_id = auth.uid())
);

-- Sender can delete own message
CREATE POLICY "Sender can delete own message"
ON public.messages FOR DELETE TO authenticated
USING (sender_id = auth.uid());

-- Trigger: notify recipients on new message
CREATE OR REPLACE FUNCTION public.tg_messages_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ev record;
  sender_name text;
BEGIN
  SELECT id, title, organizer_id INTO ev FROM public.events WHERE id = NEW.event_id;
  SELECT full_name INTO sender_name FROM public.profiles WHERE id = NEW.sender_id;

  IF NEW.is_announcement THEN
    -- Notify all non-cancelled registered volunteers
    INSERT INTO public.notifications (user_id, type, title, description, event_id, event_name)
    SELECT r.volunteer_id, 'organizer_announcement', 'Announcement: ' || ev.title,
           COALESCE(sender_name, 'Organizer') || ': ' || left(NEW.body, 140),
           ev.id, ev.title
    FROM public.event_registrations r
    WHERE r.event_id = ev.id AND r.status <> 'cancelled' AND r.volunteer_id <> NEW.sender_id;
  ELSE
    -- Direct message: notify organizer (if sender is volunteer) or all volunteers (skip if sender is organizer w/o announcement — treat as broadcast to volunteers)
    IF NEW.sender_id = ev.organizer_id THEN
      INSERT INTO public.notifications (user_id, type, title, description, event_id, event_name)
      SELECT r.volunteer_id, 'new_message', 'New message: ' || ev.title,
             COALESCE(sender_name,'Organizer') || ': ' || left(NEW.body,140), ev.id, ev.title
      FROM public.event_registrations r
      WHERE r.event_id = ev.id AND r.status <> 'cancelled';
    ELSE
      INSERT INTO public.notifications (user_id, type, title, description, event_id, event_name)
      VALUES (ev.organizer_id, 'new_message', 'New message: ' || ev.title,
              COALESCE(sender_name,'Volunteer') || ': ' || left(NEW.body,140), ev.id, ev.title);
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS messages_notify_ai ON public.messages;
CREATE TRIGGER messages_notify_ai AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.tg_messages_notify();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
