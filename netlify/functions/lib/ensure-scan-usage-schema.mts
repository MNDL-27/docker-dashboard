import { sql } from "./db.mjs";

let schemaEnsured = false;

export async function ensureScanUsageSchema() {
  if (schemaEnsured) return;

  await sql`
    CREATE TABLE IF NOT EXISTS public.organization_monthly_scan_usage (
      organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      month_bucket date NOT NULL,
      scan_count integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (organization_id, month_bucket)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_org_monthly_scan_usage_month
    ON public.organization_monthly_scan_usage (month_bucket)
  `;

  schemaEnsured = true;
}
