import { sql } from "./db.mjs";
import { getActiveEncryptionKeyId, isSecretUsingActiveKey, reencryptSecret } from "./crypto.mjs";

export interface SecretMigrationScope {
  organizationId?: string | null;
  hostId?: string | null;
  dryRun?: boolean;
}

export interface SecretMigrationResult {
  activeKeyId: string;
  migratedCount: number;
  alreadyCurrentCount: number;
  failedCount: number;
  scannedCount: number;
  failures: Array<{ hostId: string; field: string; error: string }>;
}

export async function runSecretMigration(scope: SecretMigrationScope): Promise<SecretMigrationResult> {
  const secrets = scope.hostId
    ? await sql`
        SELECT s.*
        FROM public.docker_host_secrets s
        JOIN public.docker_hosts h ON h.id = s.host_id
        WHERE s.host_id = ${scope.hostId}
      `
    : scope.organizationId
      ? await sql`
          SELECT s.*
          FROM public.docker_host_secrets s
          JOIN public.docker_hosts h ON h.id = s.host_id
          WHERE h.organization_id = ${scope.organizationId}
        `
      : await sql`
          SELECT s.*
          FROM public.docker_host_secrets s
          JOIN public.docker_hosts h ON h.id = s.host_id
        `;

  let migratedCount = 0;
  let alreadyCurrentCount = 0;
  let failedCount = 0;
  const failures: Array<{ hostId: string; field: string; error: string }> = [];

  for (const secret of secrets as Array<Record<string, string | null>>) {
    try {
      const needsUpdate =
        (!!secret.agent_api_key && !isSecretUsingActiveKey(secret.agent_api_key)) ||
        (!!secret.cf_service_token_id && !isSecretUsingActiveKey(secret.cf_service_token_id)) ||
        (!!secret.cf_service_token_secret && !isSecretUsingActiveKey(secret.cf_service_token_secret));

      if (!needsUpdate) {
        alreadyCurrentCount++;
        continue;
      }

      if (scope.dryRun) {
        migratedCount++;
        continue;
      }

      const newAgentKey = secret.agent_api_key
        ? reencryptSecret(secret.agent_api_key, String(secret.host_id), "agent_api_key")
        : null;
      const newCfId = secret.cf_service_token_id
        ? reencryptSecret(secret.cf_service_token_id, String(secret.host_id), "cf_service_token_id")
        : null;
      const newCfSecret = secret.cf_service_token_secret
        ? reencryptSecret(secret.cf_service_token_secret, String(secret.host_id), "cf_service_token_secret")
        : null;

      await sql`
        UPDATE public.docker_host_secrets
        SET
          agent_api_key = ${newAgentKey},
          cf_service_token_id = ${newCfId},
          cf_service_token_secret = ${newCfSecret}
        WHERE host_id = ${String(secret.host_id)}
      `;

      migratedCount++;
    } catch (error) {
      failedCount++;
      failures.push({
        hostId: String(secret.host_id),
        field: "docker_host_secrets",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return {
    activeKeyId: getActiveEncryptionKeyId(),
    migratedCount,
    alreadyCurrentCount,
    failedCount,
    scannedCount: secrets.length,
    failures,
  };
}
