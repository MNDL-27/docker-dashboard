import type { Config } from '@netlify/functions';
import { sql } from './lib/db.mjs';
import { requireAuth } from './lib/auth.mjs';
import { getActiveEncryptionKeyId, isSecretUsingActiveKey, reencryptSecret } from './lib/crypto.mjs';
import { isPlatformAdminEmail } from './lib/platform-admin.mjs';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

export default async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });

  try {
    const auth = await requireAuth(req);
    if (!auth.userId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
    const user = await sql`SELECT email FROM users WHERE id = ${auth.userId}`;
    if (!user.length || !isPlatformAdminEmail(user[0].email)) {
      return new Response(JSON.stringify({ error: 'Forbidden. Admin access required.' }), { status: 403, headers });
    }
    
    // Fetch all secrets across all organizations/hosts
    const secrets = await sql`SELECT * FROM docker_host_secrets`;
    let migratedCount = 0;
    let alreadyCurrentCount = 0;
    let failedCount = 0;
    const failures: Array<{ hostId: string; field: string; error: string }> = [];

    for (const secret of secrets) {
      try {
        const newAgentKey = secret.agent_api_key
          ? reencryptSecret(secret.agent_api_key, secret.host_id, 'agent_api_key')
          : null;
        const newCfId = secret.cf_service_token_id
          ? reencryptSecret(secret.cf_service_token_id, secret.host_id, 'cf_service_token_id')
          : null;
        const newCfSecret = secret.cf_service_token_secret
          ? reencryptSecret(secret.cf_service_token_secret, secret.host_id, 'cf_service_token_secret')
          : null;

        const needsUpdate =
          !!secret.agent_api_key && !isSecretUsingActiveKey(secret.agent_api_key) ||
          !!secret.cf_service_token_id && !isSecretUsingActiveKey(secret.cf_service_token_id) ||
          !!secret.cf_service_token_secret && !isSecretUsingActiveKey(secret.cf_service_token_secret);

        if (!needsUpdate) {
          alreadyCurrentCount++;
          continue;
        }

        await sql`
          UPDATE docker_host_secrets 
          SET 
            agent_api_key = ${newAgentKey},
            cf_service_token_id = ${newCfId},
            cf_service_token_secret = ${newCfSecret}
          WHERE id = ${secret.id}
        `;
        migratedCount++;
      } catch (err: any) {
        failedCount++;
        failures.push({
          hostId: secret.host_id,
          field: 'docker_host_secrets',
          error: err.message || 'Unknown error',
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      activeKeyId: getActiveEncryptionKeyId(),
      migratedCount,
      alreadyCurrentCount,
      failedCount,
      failures,
    }), { headers });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
};

export const config: Config = {
  path: '/api/admin/migrate-secrets',
};
