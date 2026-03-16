-- ============================================================
-- Private Beta: email allowlist + user approval flag
-- ============================================================

-- 1. Allowlist table – the pre-populated invite list.
--    Emails are stored lowercased on insert via trigger.
CREATE TABLE public.beta_allowlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  notes text  -- optional: "founder", "investor", etc.
);

-- Case-insensitive unique index: prevents duplicates regardless of casing
CREATE UNIQUE INDEX beta_allowlist_email_lower_idx
  ON public.beta_allowlist (lower(email));

-- Trigger to force-lowercase email on insert/update
CREATE OR REPLACE FUNCTION public.beta_allowlist_normalize_email()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.email := lower(NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER beta_allowlist_normalize_email_trg
  BEFORE INSERT OR UPDATE ON public.beta_allowlist
  FOR EACH ROW EXECUTE FUNCTION public.beta_allowlist_normalize_email();

-- 2. Add is_approved flag to users (default false = blocked)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false;

-- 3. Auto-approve any existing users whose email is already allowlisted
UPDATE public.users u
  SET is_approved = true
  FROM public.beta_allowlist a
  WHERE lower(u.email) = lower(a.email);
