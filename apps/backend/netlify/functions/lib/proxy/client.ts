import { buildValidatedAgentUrl } from '../host-url.mjs';
import type { Host, HostSecrets } from './types';

export function buildRequest(
  host: Host,
  secrets: HostSecrets | null,
  dockerPath: string,
  method: string,
) {
  const base = host.host_url.replace(/\/$/, '');
  const reqHeaders: Record<string, string> = {};

  const url = buildValidatedAgentUrl(base, `/docker${dockerPath}`);

  if (secrets?.agent_api_key) {
    reqHeaders['X-Agent-Key'] = secrets.agent_api_key;
  }

  if (host.docker_socket_path && host.docker_socket_path !== '/var/run/docker.sock') {
    reqHeaders['X-Docker-Socket'] = host.docker_socket_path;
  }

  if (host.connection_mode === 'cloudflare_tunnel') {
    if (secrets?.cf_service_token_id) reqHeaders['CF-Access-Client-Id'] = secrets.cf_service_token_id;
    if (secrets?.cf_service_token_secret) reqHeaders['CF-Access-Client-Secret'] = secrets.cf_service_token_secret;
  }

  return { url, method, headers: reqHeaders };
}

export function buildAgentRequest(
  host: Host,
  secrets: HostSecrets | null,
  agentPath: string,
  method: string,
) {
  const base = host.host_url.replace(/\/$/, '');
  const reqHeaders: Record<string, string> = {};

  const url = buildValidatedAgentUrl(base, agentPath);

  if (secrets?.agent_api_key) {
    reqHeaders['X-Agent-Key'] = secrets.agent_api_key;
  }

  if (host.docker_socket_path && host.docker_socket_path !== '/var/run/docker.sock') {
    reqHeaders['X-Docker-Socket'] = host.docker_socket_path;
  }

  if (host.connection_mode === 'cloudflare_tunnel') {
    if (secrets?.cf_service_token_id) reqHeaders['CF-Access-Client-Id'] = secrets.cf_service_token_id;
    if (secrets?.cf_service_token_secret) reqHeaders['CF-Access-Client-Secret'] = secrets.cf_service_token_secret;
  }

  return { url, method, headers: reqHeaders };
}

export async function dockerFetch(
  url: string,
  method: string,
  reqHeaders: Record<string, string>,
  timeoutMs = 5000,
  maxPayloadSize = 4 * 1024 * 1024,
) {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: reqHeaders,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err: unknown) {
    const errObj = err instanceof Error ? err : new Error(String(err));
    if (errObj.name === 'AbortError' || errObj.name === 'TimeoutError') {
      return new Response(JSON.stringify({ error: 'Agent connection timed out' }), { status: 504, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ error: 'Agent connection failed', details: errObj.message }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  }

  if (!response.body) return response;

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalSize = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalSize += value.length;
        if (totalSize > maxPayloadSize) {
          reader.cancel('Payload too large');
          const limitMB = Math.round(maxPayloadSize / (1024 * 1024));
          return new Response(JSON.stringify({ error: `Payload too large (exceeds ${limitMB}MB limit)` }), {
            status: 413,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        chunks.push(value);
      }
    }
  } catch (err: unknown) {
    const errObj = err instanceof Error ? err : new Error(String(err));
    if (errObj.name === 'AbortError' || errObj.name === 'TimeoutError') {
      return new Response(JSON.stringify({ error: 'Agent stream timed out' }), { status: 504, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ error: 'Stream read error', details: errObj.message }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  }

  const fullBody = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of chunks) {
    fullBody.set(chunk, offset);
    offset += chunk.length;
  }

  const newHeaders = new Headers(response.headers);
  newHeaders.delete('content-encoding');
  return new Response(fullBody, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}
