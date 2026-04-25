-- Remove the scan quota system: drop the monthly scan usage table entirely.
-- The scan quota feature has been replaced by node-limit-based cost control.
DROP INDEX IF EXISTS idx_org_monthly_scan_usage_month;
DROP TABLE IF EXISTS public.organization_monthly_scan_usage CASCADE;
