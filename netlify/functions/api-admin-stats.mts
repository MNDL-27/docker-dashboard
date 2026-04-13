import type { Config } from '@netlify/functions';
import { handleAdminRequest } from './lib/admin-handler.mjs';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

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
    }
  }), { headers });
};

export const config: Config = {
  path: '/api/admin/stats',
};
