CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, chosen_role)
  ON CONFLICT (user_id) DO NOTHING;

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
$function$;

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;