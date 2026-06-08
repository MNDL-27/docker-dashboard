import { sql } from '../db.mjs';
import { ensureDockerHostSchema } from '../ensure-docker-host-schema.mjs';

export interface ProxyAuditRecord {
  organizationId: string;
  actorUserId: string;
  action: string;
  hostId: string;
  containerId?: string;
  path?: string;
  requestMetadata?: Record<string, unknown>;
}

let proxyAuditSchemaEnsured = false;

export async function ensureProxyAuditSchema() {
  if (proxyAuditSchemaEnsured) return;
  
  await ensureDockerHostSchema();
  
  await sql`
    CREATE TABLE IF NOT EXISTS public.proxy_audit_log (
      id BIGSERIAL PRIMARY KEY,
      organization_id TEXT NOT NULL,
      actor_user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      host_id TEXT NOT NULL,
      container_id TEXT,
      path TEXT,
      request_metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `;
  
  await sql`
    CREATE INDEX IF NOT EXISTS idx_proxy_audit_log_org_created 
    ON public.proxy_audit_log (organization_id, created_at DESC)
  `;
  
  await sql`
    CREATE INDEX IF NOT EXISTS idx_proxy_audit_log_host 
    ON public.proxy_audit_log (host_id, created_at DESC)
  `;
  
  proxyAuditSchemaEnsured = true;
}

export async function recordProxyAudit(entry: ProxyAuditRecord) {
  try {
    await ensureProxyAuditSchema();
    await sql`
      INSERT INTO public.proxy_audit_log (
        organization_id,
        actor_user_id,
        action,
        host_id,
        container_id,
        path,
        request_metadata
      )
      VALUES (
        ${entry.organizationId},
        ${entry.actorUserId},
        ${entry.action},
        ${entry.hostId},
        ${entry.containerId ?? null},
        ${entry.path ?? null},
        ${JSON.stringify(entry.requestMetadata ?? {})}::jsonb
      )
    `;
  } catch (e) {
    console.error('[proxy-audit] failed to record audit log', e);
  }
}
