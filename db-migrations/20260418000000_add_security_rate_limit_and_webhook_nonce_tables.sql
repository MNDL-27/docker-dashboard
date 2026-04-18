-- 20260418000000_add_security_rate_limit_and_webhook_nonce_tables.sql
-- Shared security state for rate limiting and webhook replay protection.

CREATE TABLE IF NOT EXISTS public.security_rate_limits (
  key text NOT NULL,
  window_start_ms bigint NOT NULL,
  window_ms integer NOT NULL,
  count integer NOT NULL DEFAULT 1,
  reset_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (key, window_start_ms),
  CONSTRAINT security_rate_limits_count_positive CHECK (count > 0),
  CONSTRAINT security_rate_limits_window_positive CHECK (window_ms > 0)
);

CREATE INDEX IF NOT EXISTS idx_security_rate_limits_reset_at
  ON public.security_rate_limits (reset_at);

CREATE TABLE IF NOT EXISTS public.security_webhook_nonces (
  nonce text PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_webhook_nonces_expires_at
  ON public.security_webhook_nonces (expires_at);

DROP TRIGGER IF EXISTS update_security_rate_limits_updated_at ON public.security_rate_limits;
CREATE TRIGGER update_security_rate_limits_updated_at
BEFORE UPDATE ON public.security_rate_limits
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
