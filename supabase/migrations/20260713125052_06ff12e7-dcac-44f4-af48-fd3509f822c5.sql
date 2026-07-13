
-- Roles enum + table
CREATE TYPE public.app_role AS ENUM ('volunteer', 'organizer');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own role" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Security definer role check
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_role()
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  student_id TEXT,
  department TEXT,
  phone TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by authenticated users" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Auto-create profile + role on signup (role read from user metadata)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  chosen_role public.app_role;
BEGIN
  chosen_role := COALESCE(
    (NEW.raw_user_meta_data->>'role')::public.app_role,
    'volunteer'::public.app_role
  );

  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, chosen_role)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Events
CREATE TYPE public.event_status AS ENUM ('draft', 'published', 'cancelled', 'archived');

CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  location TEXT,
  capacity INT NOT NULL DEFAULT 0,
  instructions TEXT,
  required_items TEXT,
  service_hours NUMERIC(5,2) NOT NULL DEFAULT 0,
  registration_deadline TIMESTAMPTZ,
  status public.event_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can view published events" ON public.events
  FOR SELECT TO authenticated USING (status = 'published' OR organizer_id = auth.uid());
CREATE POLICY "Organizers create their own events" ON public.events
  FOR INSERT TO authenticated
  WITH CHECK (organizer_id = auth.uid() AND public.has_role(auth.uid(), 'organizer'));
CREATE POLICY "Organizers update their own events" ON public.events
  FOR UPDATE TO authenticated USING (organizer_id = auth.uid());
CREATE POLICY "Organizers delete their own events" ON public.events
  FOR DELETE TO authenticated USING (organizer_id = auth.uid());

-- Registrations
CREATE TYPE public.registration_status AS ENUM ('registered', 'cancelled', 'attended');

CREATE TABLE public.event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  volunteer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.registration_status NOT NULL DEFAULT 'registered',
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, volunteer_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_registrations TO authenticated;
GRANT ALL ON public.event_registrations TO service_role;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Volunteers view their own registrations" ON public.event_registrations
  FOR SELECT TO authenticated USING (
    volunteer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.organizer_id = auth.uid())
  );
CREATE POLICY "Volunteers register themselves" ON public.event_registrations
  FOR INSERT TO authenticated
  WITH CHECK (volunteer_id = auth.uid() AND public.has_role(auth.uid(), 'volunteer'));
CREATE POLICY "Volunteers update their own registrations, organizers update their events" ON public.event_registrations
  FOR UPDATE TO authenticated USING (
    volunteer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.organizer_id = auth.uid())
  );
CREATE POLICY "Volunteers delete their own registrations" ON public.event_registrations
  FOR DELETE TO authenticated USING (volunteer_id = auth.uid());

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER events_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_events_status_start ON public.events(status, start_at);
CREATE INDEX idx_registrations_volunteer ON public.event_registrations(volunteer_id);
CREATE INDEX idx_registrations_event ON public.event_registrations(event_id);
