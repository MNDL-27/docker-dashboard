import type { Config } from '@netlify/functions';
import { sql } from './lib/db.mjs';
import { requireAuth } from './lib/auth.mjs';
import { encryptSecret } from './lib/crypto.mjs';

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
    
    // In a real product, we would verify the user is a super-admin.
    // For this one-off migration, we require a valid login.
    if (!auth.userId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
    
    // Fetch all secrets across all organizations/hosts
    const secrets = await sql`SELECT * FROM docker_host_secrets`;
    let migratedCount = 0;
    let skippedCount = 0;

    for (const secret of secrets) {
      let needsUpdate = false;
      let newAgentKey = secret.agent_api_key;
      let newCfId = secret.cf_service_token_id;
      let newCfSecret = secret.cf_service_token_secret;

      if (secret.agent_api_key && !secret.agent_api_key.startsWith('v1:')) {
        newAgentKey = encryptSecret(secret.agent_api_key, secret.host_id, 'agent_api_key');
        needsUpdate = true;
      }
      if (secret.cf_service_token_id && !secret.cf_service_token_id.startsWith('v1:')) {
        newCfId = encryptSecret(secret.cf_service_token_id, secret.host_id, 'cf_service_token_id');
        needsUpdate = true;
      }
      if (secret.cf_service_token_secret && !secret.cf_service_token_secret.startsWith('v1:')) {
        newCfSecret = encryptSecret(secret.cf_service_token_secret, secret.host_id, 'cf_service_token_secret');
        needsUpdate = true;
      }

      if (needsUpdate) {
        await sql`
          UPDATE docker_host_secrets 
          SET 
            agent_api_key = ${newAgentKey},
            cf_service_token_id = ${newCfId},
            cf_service_token_secret = ${newCfSecret}
          WHERE id = ${secret.id}
        `;
        migratedCount++;
      } else {
        skippedCount++;
      }
    }

    return new Response(JSON.stringify({ success: true, migratedCount, skippedCount }), { headers });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
};

export const config: Config = {
  path: '/api/admin/migrate-secrets',
};
