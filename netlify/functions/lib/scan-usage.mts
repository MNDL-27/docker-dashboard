import { sql } from "./db.mjs";
import { resolveOrganizationEntitlements } from "./access-controls.mjs";
import { ensureScanUsageSchema } from "./ensure-scan-usage-schema.mjs";

export interface OrganizationScanQuotaSummary {
  monthBucket: string;
  monthlyScanLimit: number | null;
  scansUsed: number;
  scansRemaining: number | null;
  scansExceeded: boolean;
}

export interface ScanQuotaConsumeResult extends OrganizationScanQuotaSummary {
  allowed: boolean;
}

function monthBucketToDateString(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

function dateStringToMonthBucket(dateString: string) {
  return dateString.slice(0, 7);
}

async function getCurrentUsageCount(organizationId: string, monthBucketDate: string) {
  const [row] = await sql<Array<{ scan_count: number | string | null }>>`
    SELECT scan_count
    FROM public.organization_monthly_scan_usage
    WHERE organization_id = ${organizationId}
      AND month_bucket = ${monthBucketDate}::date
    LIMIT 1
  `;

  const count = Number(row?.scan_count ?? 0);
  return Number.isFinite(count) && count >= 0 ? count : 0;
}

export async function getOrganizationScanQuotaSummary({
  organizationId,
  isPlatformAdmin,
}: {
  organizationId: string;
  isPlatformAdmin: boolean;
}): Promise<OrganizationScanQuotaSummary> {
  await ensureScanUsageSchema();

  const entitlements = await resolveOrganizationEntitlements({
    organizationId,
    isPlatformAdmin,
  });

  const monthBucketDate = monthBucketToDateString();
  const scansUsed = await getCurrentUsageCount(organizationId, monthBucketDate);
  const monthlyScanLimit = entitlements.monthlyScanLimit;
  const scansRemaining = monthlyScanLimit === null ? null : Math.max(monthlyScanLimit - scansUsed, 0);

  return {
    monthBucket: dateStringToMonthBucket(monthBucketDate),
    monthlyScanLimit,
    scansUsed,
    scansRemaining,
    scansExceeded: monthlyScanLimit !== null && scansUsed >= monthlyScanLimit,
  };
}

export async function consumeOrganizationScanQuota({
  organizationId,
  isPlatformAdmin,
  units = 1,
}: {
  organizationId: string;
  isPlatformAdmin: boolean;
  units?: number;
}): Promise<ScanQuotaConsumeResult> {
  const normalizedUnits = Number.isFinite(units) ? Math.max(1, Math.floor(units)) : 1;

  const summary = await getOrganizationScanQuotaSummary({ organizationId, isPlatformAdmin });
  const { monthlyScanLimit, scansUsed } = summary;

  if (monthlyScanLimit === null) {
    return { ...summary, allowed: true };
  }

  const monthBucketDate = `${summary.monthBucket}-01`;

  const upsertRows = await sql<Array<{ scan_count: number | string | null }>>`
    INSERT INTO public.organization_monthly_scan_usage (organization_id, month_bucket, scan_count)
    VALUES (${organizationId}, ${monthBucketDate}::date, ${normalizedUnits})
    ON CONFLICT (organization_id, month_bucket) DO UPDATE
    SET
      scan_count = public.organization_monthly_scan_usage.scan_count + EXCLUDED.scan_count,
      updated_at = now()
    WHERE public.organization_monthly_scan_usage.scan_count + EXCLUDED.scan_count <= ${monthlyScanLimit}
    RETURNING scan_count
  `;

  if (upsertRows.length > 0) {
    const updatedUsed = Number(upsertRows[0].scan_count ?? scansUsed);
    const normalizedUsed = Number.isFinite(updatedUsed) && updatedUsed >= 0 ? updatedUsed : scansUsed;
    return {
      monthBucket: summary.monthBucket,
      monthlyScanLimit,
      scansUsed: normalizedUsed,
      scansRemaining: Math.max(monthlyScanLimit - normalizedUsed, 0),
      scansExceeded: normalizedUsed >= monthlyScanLimit,
      allowed: true,
    };
  }

  const currentUsed = await getCurrentUsageCount(organizationId, monthBucketDate);
  return {
    monthBucket: summary.monthBucket,
    monthlyScanLimit,
    scansUsed: currentUsed,
    scansRemaining: Math.max(monthlyScanLimit - currentUsed, 0),
    scansExceeded: currentUsed >= monthlyScanLimit,
    allowed: false,
  };
}
