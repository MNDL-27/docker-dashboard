ALTER TABLE public.users ADD COLUMN IF NOT EXISTS onboarding_reminder_email_sent_at timestamptz;
