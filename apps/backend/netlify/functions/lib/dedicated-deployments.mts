import { sql } from "./db.mjs";
import { ensureDedicatedDeploymentSchema } from "./ensure-dedicated-deployment-schema.mjs";
import type { AppAuthContext } from "./auth.mjs";

export type DedicatedDeploymentStatus =
  | "intake_received"
  | "capacity_reserved"
  | "provisioning"
  | "hardening"
  | "ready_for_handoff"
  | "active";

function buildReferenceId() {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `DD-DED-${yyyy}${mm}${dd}-${suffix}`;
}

export function buildDeploymentChecklist(payload: Record<string, unknown>, status: DedicatedDeploymentStatus) {
  const requiresSSO = Boolean(payload.requiresSSO);
  const integrations = Array.isArray(payload.integrations) ? payload.integrations.map(String) : [];

  return [
    {
      id: "brief",
      label: "Deployment brief accepted",
      completed: true,
    },
    {
      id: "contacts",
      label: "Technical owner and escalation contacts captured",
      completed: Boolean(payload.technicalOwnerName) && Boolean(payload.technicalOwnerEmail),
    },
    {
      id: "identity",
      label: requiresSSO ? "SSO requirements queued for handoff" : "Identity model confirmed",
      completed: status !== "intake_received",
    },
    {
      id: "integrations",
      label: integrations.length > 0 ? "Integration requirements staged" : "Initial integration scope confirmed",
      completed: status === "hardening" || status === "ready_for_handoff" || status === "active",
    },
    {
      id: "handoff",
      label: "Handoff workspace prepared",
      completed: status === "ready_for_handoff" || status === "active",
    },
  ];
}

export async function listUserOrganizations(userId: string) {
  await ensureDedicatedDeploymentSchema();
  return sql<{ organization_id: string }[]>`
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = ${userId}
    ORDER BY created_at ASC
  `;
}

export async function getCurrentDedicatedDeployment(auth: AppAuthContext) {
  await ensureDedicatedDeploymentSchema();

  let organizationId = auth.orgId;
  if (!organizationId) {
    const orgs = await listUserOrganizations(auth.userId);
    organizationId = orgs[0]?.organization_id ?? null;
  }

  if (!organizationId) {
    return null;
  }

  const rows = await sql<any[]>`
    SELECT
      organization_id,
      reference_id,
      plan_id,
      status,
      target_window_label,
      latest_update_note,
      intake_payload,
      technical_owner_name,
      technical_owner_email,
      created_at,
      updated_at
    FROM public.dedicated_deployments
    WHERE organization_id = ${organizationId}
    LIMIT 1
  `;

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    organization_id: String(row.organization_id),
    reference_id: String(row.reference_id),
    plan_id: "enterprise" as const,
    status: String(row.status) as DedicatedDeploymentStatus,
    target_window_label: String(row.target_window_label),
    latest_update_at: new Date(String(row.updated_at)).toISOString(),
    latest_update_note: String(row.latest_update_note),
    technical_owner_name: String(row.technical_owner_name || ""),
    technical_owner_email: String(row.technical_owner_email || ""),
    intake_payload: (row.intake_payload || {}) as Record<string, unknown>,
    checklist: buildDeploymentChecklist((row.intake_payload || {}) as Record<string, unknown>, String(row.status) as DedicatedDeploymentStatus),
    created_at: new Date(String(row.created_at)).toISOString(),
    updated_at: new Date(String(row.updated_at)).toISOString(),
  };
}

export async function createOrUpdateDedicatedDeployment(auth: AppAuthContext, payload: Record<string, unknown>) {
  await ensureDedicatedDeploymentSchema();

  if (!auth.orgId) {
    throw new Error("Select an active organization before starting a dedicated deployment.");
  }

  const referenceId = buildReferenceId();
  const technicalOwnerName = typeof payload.technicalOwnerName === "string" ? payload.technicalOwnerName.trim() : "";
  const technicalOwnerEmail = typeof payload.technicalOwnerEmail === "string" ? payload.technicalOwnerEmail.trim() : "";

  const [row] = await sql<any[]>`
    INSERT INTO public.dedicated_deployments (
      organization_id,
      reference_id,
      plan_id,
      status,
      target_window_label,
      latest_update_note,
      intake_payload,
      technical_owner_name,
      technical_owner_email,
      created_by
    ) VALUES (
      ${auth.orgId},
      ${referenceId},
      'enterprise',
      'intake_received',
      '3-5 business days',
      'Deployment brief accepted. Capacity review starts next.',
      ${JSON.stringify(payload)}::jsonb,
      ${technicalOwnerName},
      ${technicalOwnerEmail},
      ${auth.userId}
    )
    ON CONFLICT (organization_id) DO UPDATE
    SET
      plan_id = 'enterprise',
      status = CASE
        WHEN public.dedicated_deployments.status = 'active' THEN public.dedicated_deployments.status
        ELSE 'intake_received'
      END,
      target_window_label = '3-5 business days',
      latest_update_note = 'Deployment brief accepted. Capacity review starts next.',
      intake_payload = EXCLUDED.intake_payload,
      technical_owner_name = EXCLUDED.technical_owner_name,
      technical_owner_email = EXCLUDED.technical_owner_email
    RETURNING
      organization_id,
      reference_id,
      plan_id,
      status,
      target_window_label,
      latest_update_note,
      intake_payload,
      technical_owner_name,
      technical_owner_email,
      created_at,
      updated_at
  `;

  await sql`
    INSERT INTO public.dedicated_deployment_updates (
      organization_id,
      status,
      note,
      created_by
    ) VALUES (
      ${auth.orgId},
      ${row.status},
      'Deployment brief accepted. Capacity review starts next.',
      ${auth.userId}
    )
  `;

  return {
    organization_id: String(row.organization_id),
    reference_id: String(row.reference_id),
    plan_id: "enterprise" as const,
    status: String(row.status) as DedicatedDeploymentStatus,
    target_window_label: String(row.target_window_label),
    latest_update_at: new Date(String(row.updated_at)).toISOString(),
    latest_update_note: String(row.latest_update_note),
    technical_owner_name: String(row.technical_owner_name || ""),
    technical_owner_email: String(row.technical_owner_email || ""),
    intake_payload: (row.intake_payload || {}) as Record<string, unknown>,
    checklist: buildDeploymentChecklist((row.intake_payload || {}) as Record<string, unknown>, String(row.status) as DedicatedDeploymentStatus),
    created_at: new Date(String(row.created_at)).toISOString(),
    updated_at: new Date(String(row.updated_at)).toISOString(),
  };
}
