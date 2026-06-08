import { sql } from "./db.mjs";
import { ensureAdminSchema } from "./ensure-admin-schema.mjs";

export interface AdminAuditRecord {
  actorUserId: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  reason: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  requestMetadata?: Record<string, unknown>;
}

export function normalizeAdminReason(reason: unknown): string {
  return typeof reason === "string" ? reason.trim() : "";
}

export function assertAdminReason(reason: string) {
  if (!reason.trim()) {
    throw new Error("Reason is required for admin actions.");
  }
}

export async function recordAdminAudit(entry: AdminAuditRecord) {
  await ensureAdminSchema();
  await sql`
    INSERT INTO public.admin_audit_log (
      actor_user_id,
      actor_email,
      action,
      target_type,
      target_id,
      reason,
      before_state,
      after_state,
      request_metadata
    )
    VALUES (
      ${entry.actorUserId},
      ${entry.actorEmail},
      ${entry.action},
      ${entry.targetType},
      ${entry.targetId},
      ${entry.reason},
      ${JSON.stringify(entry.beforeState ?? {})}::jsonb,
      ${JSON.stringify(entry.afterState ?? {})}::jsonb,
      ${JSON.stringify(entry.requestMetadata ?? {})}::jsonb
    )
  `;
}
