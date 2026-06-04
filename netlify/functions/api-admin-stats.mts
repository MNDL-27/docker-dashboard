import type { Config } from '@netlify/functions';
import { buildCorsHeaders } from './lib/security.mjs';
import { handleAdminRequest } from './lib/admin-handler.mjs';


const buildHeaders = (req: Request) => buildCorsHeaders(req);
export default async (req: Request) => {
  const forwarded = new Request(req.url.replace('/stats', '/overview'), {
    method: req.method,
    headers: req.headers,
  });
  const response = await handleAdminRequest(forwarded);
  if (!response.ok) return response;

  const data = await response.json();
  return new Response(JSON.stringify({
    success: true,
    stats: {
      totalOrgs: data.metrics.total_organizations,
      totalUsers: data.metrics.total_users,
      activeHosts: data.metrics.active_hosts,
      activeUsers: data.metrics.active_users,
    }
  }), { headers: buildHeaders(req) });
};

export const config: Config = {
  path: '/api/admin/stats',
};
