import type { Config } from '@netlify/functions';
import { sql } from './lib/db.mjs';
import { CURRENT_WATCHTOWER_AGENT_VERSION } from './lib/agent-version.mts';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Agent-Key, X-Docker-Socket',
  'Content-Type': 'application/json'
};

export default async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/api\/mock-docker-agent/, '');

    const config = await sql`SELECT mode FROM mock_agent_config WHERE id = 1`;
    const mode = config[0]?.mode || 'success';

    if (mode === 'failure') {
      return new Response('Service Unavailable - Mock failure mode', {
        status: 503,
        headers,
      });
    }

    if (path === '/docker/_ping' || path.endsWith('/_ping')) {
      return new Response('OK', { status: 200, headers });
    }

    if (path === '/agent/version' || path.endsWith('/agent/version')) {
      return new Response(JSON.stringify({
        agent_version: CURRENT_WATCHTOWER_AGENT_VERSION,
        version: CURRENT_WATCHTOWER_AGENT_VERSION,
      }), { status: 200, headers });
    }

    if (path === '/metrics' || path.endsWith('/metrics')) {
      return new Response(JSON.stringify({
        cpu_time_ns: 1_200_000_000,
        system_time_ns: 4_800_000_000,
        online_cpus: 4,
        memory_used: 2_147_483_648,
        memory_limit: 8_589_934_592,
        network_in_bytes_per_sec: 524_288,
        network_out_bytes_per_sec: 262_144,
        disk_read_bytes_per_sec: 131_072,
        disk_write_bytes_per_sec: 65_536,
      }), { status: 200, headers });
    }

    if (path === '/docker/version' || path.endsWith('/version')) {
      return new Response(JSON.stringify({
        Version: '27.0.3-mock',
        ApiVersion: '1.46',
        Os: 'linux',
        Arch: 'amd64',
        KernelVersion: '6.1.0-mock',
        GoVersion: 'go1.22.0',
      }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: 'Not found', path }), {
      status: 404,
      headers,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
};

export const config: Config = {
  path: '/api/mock-docker-agent/*',
};
