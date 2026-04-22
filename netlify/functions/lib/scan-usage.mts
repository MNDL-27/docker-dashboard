import { sql } from "./db.mjs";
import { resolveOrganizationEntitlements } from "./access-controls.mjs";
import { ensureScanUsageSchema } from "./ensure-scan-usage-schema.mjs";
import type { PlanId } from "../../../shared/schema/plan-policy.ts";

export interface OrganizationScanQuotaSummary {
  effectivePlan: PlanId;
  monthBucket: string;
  monthlyScanLimit: number | null;
  scansUsed: number;
  scansRemaining: number | null;
  scansExceeded: boolean;
  resetAt: string;
}

export interface ScanQuotaConsumeResult extends OrganizationScanQuotaSummary {
  allowed: boolean;
  counted: boolean;
}

function monthBucketToDateString(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

function dateStringToMonthBucket(dateString: string) {
  return dateString.slice(0, 7);
}

function getEffectivePlanForScanQuota({
  plan,
  isDonorPremium,
  monthlyScanLimit,
}: {
  plan: PlanId;
  isDonorPremium: boolean;
  monthlyScanLimit: number | null;
}): PlanId {
  if (monthlyScanLimit !== null) {
    return "free";
  }

  if (plan === "free" && isDonorPremium) {
    return "pro";
  }

  return plan;
}

export function getCurrentScanMonthBucket(date = new Date()) {
  return dateStringToMonthBucket(monthBucketToDateString(date));
}

export function getNextScanResetAt(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0)).toISOString();
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
    effectivePlan: getEffectivePlanForScanQuota({
      plan: entitlements.plan,
      isDonorPremium: entitlements.isDonorPremium,
      monthlyScanLimit,
    }),
    monthBucket: dateStringToMonthBucket(monthBucketDate),
    monthlyScanLimit,
    scansUsed,
    scansRemaining,
    scansExceeded: monthlyScanLimit !== null && scansUsed >= monthlyScanLimit,
    resetAt: getNextScanResetAt(),
  };
}

export function buildScanQuotaHeaders(
  quota: OrganizationScanQuotaSummary,
  counted = false,
): Record<string, string> {
  return {
    "X-Scan-Quota-Plan": quota.effectivePlan,
    "X-Scan-Quota-Limit": quota.monthlyScanLimit === null ? "unlimited" : String(quota.monthlyScanLimit),
    "X-Scan-Quota-Used": String(quota.scansUsed),
    "X-Scan-Quota-Remaining": quota.scansRemaining === null ? "unlimited" : String(quota.scansRemaining),
    "X-Scan-Quota-Reset-At": quota.resetAt,
    "X-Scan-Quota-Counted": counted ? "true" : "false",
  };
}

export function withScanQuotaHeaders(
  headers: Record<string, string>,
  quota: OrganizationScanQuotaSummary,
  counted = false,
) {
  return {
    ...headers,
    ...buildScanQuotaHeaders(quota, counted),
  };
}

export function createScanQuotaExceededResponse(
  headers: Record<string, string>,
  quota: OrganizationScanQuotaSummary,
) {
  return new Response(
    JSON.stringify({
      error: "Monthly scan quota reached",
      code: "scan_quota_exceeded",
      details: quota.monthlyScanLimit
        ? `Your current plan allows ${quota.monthlyScanLimit} scans per month. You have used ${quota.scansUsed} in ${quota.monthBucket}. Upgrade to continue scanning.`
        : "Your current plan cannot run scans right now.",
      effective_plan: quota.effectivePlan,
      limit: quota.monthlyScanLimit,
      used: quota.scansUsed,
      remaining: quota.scansRemaining,
      month_bucket: quota.monthBucket,
      reset_at: quota.resetAt,
    }),
    {
      status: 402,
      headers: {
        "Content-Type": "application/json",
        ...withScanQuotaHeaders(headers, quota, false),
      },
    },
  );
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
    return { ...summary, allowed: true, counted: false };
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
      ...summary,
      scansUsed: normalizedUsed,
      scansRemaining: Math.max(monthlyScanLimit - normalizedUsed, 0),
      scansExceeded: normalizedUsed >= monthlyScanLimit,
      allowed: true,
      counted: normalizedUsed > scansUsed,
    };
  }

  const currentUsed = await getCurrentUsageCount(organizationId, monthBucketDate);
  return {
    ...summary,
    scansUsed: currentUsed,
    scansRemaining: Math.max(monthlyScanLimit - currentUsed, 0),
    scansExceeded: currentUsed >= monthlyScanLimit,
    allowed: false,
    counted: false,
  };
}
