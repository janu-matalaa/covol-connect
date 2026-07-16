
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';

DO $$ BEGIN
  CREATE TYPE public.organizer_status AS ENUM ('pending','approved','rejected','suspended','more_info');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'admin_new_organizer';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'admin_new_event';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'admin_new_certificate';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'admin_chat_message';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'organizer_approved';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'organizer_rejected';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'organizer_more_info';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'organizer_suspended';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'account_suspended';
