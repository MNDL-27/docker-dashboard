import { sql } from "./db.mjs";
import { ensureAdminSchema } from "./ensure-admin-schema.mjs";

export type ScanQuotaPlan = "free" | "pro" | "team" | "enterprise";

export interface OrganizationScanQuotaSnapshot {
  basePlan: ScanQuotaPlan;
  effectivePlan: ScanQuotaPlan;
  planOverride: ScanQuotaPlan | null;
  donorPremiumActive: boolean;
  isUnlimited: boolean;
  monthlyScanLimit: number | null;
  usedScans: number;
  remainingScans: number | null;
  monthBucket: string;
  resetAt: string;
}

export interface OrganizationScanConsumption extends OrganizationScanQuotaSnapshot {
  counted: boolean;
  exhausted: boolean;
}

const DEFAULT_SCAN_PLAN: ScanQuotaPlan = "free";
export const FREE_PLAN_MONTHLY_SCAN_LIMIT = 100;

function normalizePlan(value: unknown): ScanQuotaPlan {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "pro" || normalized === "team" || normalized === "enterprise") {
    return normalized;
  }
  return DEFAULT_SCAN_PLAN;
}

function toNonNegativeInteger(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }
  return Math.floor(numeric);
}

function isFutureDate(value: unknown) {
  if (!value) return false;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  return date.getTime() > Date.now();
}

export function buildScanQuotaEntitlement({
  basePlan,
  planOverride,
  donorPremiumActive,
}: {
  basePlan?: string | null;
  planOverride?: string | null;
  donorPremiumActive?: boolean;
}) {
  const normalizedBasePlan = normalizePlan(basePlan);
  const normalizedOverride =
    typeof planOverride === "string" && planOverride.trim()
      ? normalizePlan(planOverride)
      : null;
  const premiumActive = donorPremiumActive === true;
  const resolvedPlan = normalizedOverride ?? normalizedBasePlan;
  const effectivePlan = resolvedPlan === "free" && premiumActive ? "pro" : resolvedPlan;
  const monthlyScanLimit = effectivePlan === "free" ? FREE_PLAN_MONTHLY_SCAN_LIMIT : null;

  return {
    basePlan: normalizedBasePlan,
    effectivePlan,
    planOverride: normalizedOverride,
    donorPremiumActive: premiumActive,
    isUnlimited: monthlyScanLimit === null,
    monthlyScanLimit,
  };
}

export function getCurrentScanMonthBucket(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

export function getNextScanResetAt(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0)).toISOString();
}

function buildScanQuotaSnapshot({
  entitlement,
  monthBucket,
  resetAt,
  usedScans,
}: {
  entitlement: ReturnType<typeof buildScanQuotaEntitlement>;
  monthBucket: string;
  resetAt: string;
  usedScans: number;
}): OrganizationScanQuotaSnapshot {
  return {
    ...entitlement,
    usedScans,
    remainingScans:
      entitlement.monthlyScanLimit === null
        ? null
        : Math.max(0, entitlement.monthlyScanLimit - usedScans),
    monthBucket,
    resetAt,
  };
}

async function readOrganizationQuotaState(organizationId: string) {
  await ensureAdminSchema();
  const rows = await sql<{
    plan: string | null;
    plan_override: string | null;
    donor_premium_expires_at: string | null;
  }[]>`
    SELECT
      o.plan,
      oac.plan_override,
      o.donor_premium_expires_at::text
    FROM public.organizations o
    LEFT JOIN public.organization_access_controls oac
      ON oac.organization_id = o.id
    WHERE o.id = ${organizationId}
    LIMIT 1
  `;

  if (rows.length === 0) {
    throw new Error("Organization not found");
  }

  const row = rows[0];
  const entitlement = buildScanQuotaEntitlement({
    basePlan: row.plan,
    planOverride: row.plan_override,
    donorPremiumActive: isFutureDate(row.donor_premium_expires_at),
  });

  return entitlement;
}

async function readOrganizationScanUsage(organizationId: string, monthBucket: string) {
  const rows = await sql<{ used_scans: number }[]>`
    SELECT used_scans
    FROM public.organization_monthly_scan_usage
    WHERE organization_id = ${organizationId}
      AND month_bucket = ${monthBucket}
    LIMIT 1
  `;

  return toNonNegativeInteger(rows[0]?.used_scans ?? 0);
}

export async function getOrganizationScanQuotaSnapshot(organizationId: string): Promise<OrganizationScanQuotaSnapshot> {
  const monthBucket = getCurrentScanMonthBucket();
  const resetAt = getNextScanResetAt();
  const entitlement = await readOrganizationQuotaState(organizationId);
  const usedScans = await readOrganizationScanUsage(organizationId, monthBucket);

  return buildScanQuotaSnapshot({
    entitlement,
    monthBucket,
    resetAt,
    usedScans,
  });
}

export async function recordOrganizationScan(organizationId: string): Promise<OrganizationScanConsumption> {
  const snapshot = await getOrganizationScanQuotaSnapshot(organizationId);
  if (snapshot.isUnlimited || snapshot.monthlyScanLimit === null) {
    return {
      ...snapshot,
      counted: false,
      exhausted: false,
    };
  }

  const updated = await sql<{ used_scans: number }[]>`
    INSERT INTO public.organization_monthly_scan_usage (
      organization_id,
      month_bucket,
      used_scans,
      created_at,
      updated_at
    )
    VALUES (
      ${organizationId},
      ${snapshot.monthBucket},
      1,
      now(),
      now()
    )
    ON CONFLICT (organization_id, month_bucket) DO UPDATE
    SET
      used_scans = public.organization_monthly_scan_usage.used_scans + 1,
      updated_at = now()
    WHERE public.organization_monthly_scan_usage.used_scans < ${snapshot.monthlyScanLimit}
    RETURNING used_scans
  `;

  if (updated.length === 0) {
    return {
      ...(await getOrganizationScanQuotaSnapshot(organizationId)),
      counted: false,
      exhausted: true,
    };
  }

  const usedScans = toNonNegativeInteger(updated[0].used_scans);

  return {
    ...snapshot,
    usedScans,
    remainingScans: Math.max(0, snapshot.monthlyScanLimit - usedScans),
    counted: true,
    exhausted: false,
  };
}

export function buildScanQuotaHeaders(snapshot: OrganizationScanQuotaSnapshot, counted = false): Record<string, string> {
  return {
    "X-Scan-Quota-Plan": snapshot.effectivePlan,
    "X-Scan-Quota-Limit": snapshot.monthlyScanLimit === null ? "unlimited" : String(snapshot.monthlyScanLimit),
    "X-Scan-Quota-Used": String(snapshot.usedScans),
    "X-Scan-Quota-Remaining": snapshot.remainingScans === null ? "unlimited" : String(snapshot.remainingScans),
    "X-Scan-Quota-Reset-At": snapshot.resetAt,
    "X-Scan-Quota-Counted": counted ? "true" : "false",
  };
}

export function withScanQuotaHeaders(
  headers: Record<string, string>,
  snapshot: OrganizationScanQuotaSnapshot,
  counted = false,
) {
  return {
    ...headers,
    ...buildScanQuotaHeaders(snapshot, counted),
  };
}

export function createScanQuotaExceededResponse(
  snapshot: OrganizationScanQuotaSnapshot,
  headers: Record<string, string> = {},
) {
  return new Response(
    JSON.stringify({
      error: "Scan quota exceeded",
      code: "scan_quota_exceeded",
      details: `The Free plan includes ${FREE_PLAN_MONTHLY_SCAN_LIMIT} fresh scans per month. Upgrade to restore continuous live refreshes.`,
      effective_plan: snapshot.effectivePlan,
      limit: snapshot.monthlyScanLimit,
      used: snapshot.usedScans,
      remaining: snapshot.remainingScans,
      month_bucket: snapshot.monthBucket,
      reset_at: snapshot.resetAt,
    }),
    {
      status: 402,
      headers: {
        "Content-Type": "application/json",
        ...withScanQuotaHeaders(headers, snapshot, false),
      },
    },
  );
}
