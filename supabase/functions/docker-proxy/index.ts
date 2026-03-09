import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

/**
 * Sanitize a Docker container ID to prevent path traversal.
 * Valid Docker IDs are hex strings (short 12-char or full 64-char).
 */
function sanitizeContainerId(id: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.\-]{0,127}$/.test(id)) {
    throw new Error('Invalid container ID format')
  }
  return id
}

/**
 * Build the correct fetch options for a Docker API call depending on connection mode.
 *
 * Both modes route through the Watchtower Agent over HTTPS.
 * The agent authenticates via X-Agent-Key and proxies to the local Docker socket.
 *
 * Agent mode:            HTTPS directly to agent
 * Cloudflare Tunnel:     HTTPS to agent via CF Tunnel (adds CF-Access headers for tunnel auth)
 *
 * In both cases the URL is:  https://<endpoint>/docker/<dockerPath>
 * In both cases X-Agent-Key is sent for agent-level auth.
 */
function buildRequest(
  host: { host_url: string; connection_mode: string; docker_socket_path: string },
  secrets: { agent_api_key?: string; cf_service_token_id?: string; cf_service_token_secret?: string } | null,
  dockerPath: string,
  method: string,
) {
  const base = host.host_url.replace(/\/$/, '')
  const headers: Record<string, string> = {}

  // Both modes talk to the agent — always use /docker prefix and API key
  const url = `${base}/docker${dockerPath}`

  if (secrets?.agent_api_key) {
    headers['X-Agent-Key'] = secrets.agent_api_key
  }

  // Tell agent which socket to use if non-default
  if (host.docker_socket_path && host.docker_socket_path !== '/var/run/docker.sock') {
    headers['X-Docker-Socket'] = host.docker_socket_path
  }

  // Cloudflare Tunnel: add CF Access service token headers for tunnel authentication
  if (host.connection_mode === 'cloudflare_tunnel') {
    if (secrets?.cf_service_token_id) headers['CF-Access-Client-Id'] = secrets.cf_service_token_id
    if (secrets?.cf_service_token_secret) headers['CF-Access-Client-Secret'] = secrets.cf_service_token_secret
  }

  return { url, method, headers }
}

async function dockerFetch(url: string, method: string, headers: Record<string, string>, timeoutMs = 30000) {
  return await fetch(url, {
    method,
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }

  // Auth
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: jsonHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const token = authHeader.replace('Bearer ', '')
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token)
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: jsonHeaders })
  }

  const userId = claimsData.claims.sub as string

  // Service client for reading secrets (bypasses RLS)
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  async function loadSecrets(hostId: string) {
    const { data } = await serviceClient
      .from('docker_host_secrets')
      .select('agent_api_key, cf_service_token_id, cf_service_token_secret')
      .eq('host_id', hostId)
      .maybeSingle()
    return data || null
  }

  try {
    const body = await req.json()
    const { action, hostId, orgId, containerId, params } = body

    // ── Org-wide: fetch containers from all hosts ──
    if (action === 'all-containers') {
      if (!orgId) {
        return new Response(JSON.stringify({ error: 'orgId required' }), { status: 400, headers: jsonHeaders })
      }

      const { data: membership } = await supabase
        .from('organization_members')
        .select('id')
        .eq('organization_id', orgId)
        .eq('user_id', userId)
        .maybeSingle()

      if (!membership) {
        return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: jsonHeaders })
      }

      const { data: hosts } = await serviceClient
        .from('docker_hosts')
        .select('*')
        .eq('organization_id', orgId)

      const allContainers: unknown[] = []
      for (const host of (hosts || [])) {
        try {
          const secrets = await loadSecrets(host.id)
          const { url, method, headers } = buildRequest(host, secrets, '/containers/json?all=true', 'GET')
          const resp = await dockerFetch(url, method, headers, 10000)
          if (resp.ok) {
            const containers = await resp.json()
            allContainers.push(...containers.map((c: any) => ({
              ...c, _hostId: host.id, _hostName: host.name,
            })))
            await serviceClient.from('docker_hosts').update({
              status: 'connected', last_seen_at: new Date().toISOString(),
            }).eq('id', host.id)
          } else {
            await resp.text()
            await serviceClient.from('docker_hosts').update({ status: 'error' }).eq('id', host.id)
          }
        } catch (_e) {
          await serviceClient.from('docker_hosts').update({ status: 'error' }).eq('id', host.id)
        }
      }

      return new Response(JSON.stringify(allContainers), { headers: jsonHeaders })
    }

    // ── Host-specific actions ──
    if (!hostId) {
      return new Response(JSON.stringify({ error: 'hostId required' }), { status: 400, headers: jsonHeaders })
    }

    // Fetch host (RLS ensures user has org access)
    const { data: host, error: hostError } = await supabase
      .from('docker_hosts')
      .select('*')
      .eq('id', hostId)
      .single()

    if (hostError || !host) {
      return new Response(JSON.stringify({ error: 'Host not found or access denied' }), { status: 404, headers: jsonHeaders })
    }

    const secrets = await loadSecrets(hostId)

    let dockerPath: string
    let method = 'GET'

    switch (action) {
      case 'ping':
        dockerPath = '/_ping'
        break
      case 'info':
        dockerPath = '/info'
        break
      case 'version':
        dockerPath = '/version'
        break
      case 'containers':
        dockerPath = '/containers/json?all=true'
        break
      case 'container-inspect': {
        if (!containerId) return new Response(JSON.stringify({ error: 'containerId required' }), { status: 400, headers: jsonHeaders })
        const safeId = sanitizeContainerId(containerId)
        dockerPath = `/containers/${safeId}/json`
        break
      }
      case 'container-stats': {
        if (!containerId) return new Response(JSON.stringify({ error: 'containerId required' }), { status: 400, headers: jsonHeaders })
        const safeId = sanitizeContainerId(containerId)
        dockerPath = `/containers/${safeId}/stats?stream=false`
        break
      }
      case 'container-logs': {
        if (!containerId) return new Response(JSON.stringify({ error: 'containerId required' }), { status: 400, headers: jsonHeaders })
        const safeId = sanitizeContainerId(containerId)
        const tail = params?.tail || 100
        dockerPath = `/containers/${safeId}/logs?stdout=true&stderr=true&tail=${tail}&timestamps=true`
        break
      }
      case 'container-start': {
        if (!containerId) return new Response(JSON.stringify({ error: 'containerId required' }), { status: 400, headers: jsonHeaders })
        const safeId = sanitizeContainerId(containerId)
        dockerPath = `/containers/${safeId}/start`
        method = 'POST'
        break
      }
      case 'container-stop': {
        if (!containerId) return new Response(JSON.stringify({ error: 'containerId required' }), { status: 400, headers: jsonHeaders })
        const safeId = sanitizeContainerId(containerId)
        dockerPath = `/containers/${safeId}/stop`
        method = 'POST'
        break
      }
      case 'container-restart': {
        if (!containerId) return new Response(JSON.stringify({ error: 'containerId required' }), { status: 400, headers: jsonHeaders })
        const safeId = sanitizeContainerId(containerId)
        dockerPath = `/containers/${safeId}/restart`
        method = 'POST'
        break
      }
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: jsonHeaders })
    }

    const reqData = buildRequest(host as any, secrets, dockerPath, method)
    const dockerResponse = await dockerFetch(reqData.url, reqData.method, reqData.headers)

    // ── Handle ping ──
    if (action === 'ping') {
      const text = await dockerResponse.text()
      const ok = dockerResponse.ok

      let dockerVersion = null
      let osInfo = null
      try {
        const vReq = buildRequest(host as any, secrets, '/version', 'GET')
        const vResp = await dockerFetch(vReq.url, vReq.method, vReq.headers, 5000)
        if (vResp.ok) {
          const vData = await vResp.json()
          dockerVersion = vData.Version || null
          osInfo = vData.Os ? `${vData.Os}/${vData.Arch}` : null
        } else { await vResp.text() }
      } catch (_) { /* ignore */ }

      await serviceClient.from('docker_hosts').update({
        status: ok ? 'connected' : 'error',
        last_seen_at: new Date().toISOString(),
        ...(dockerVersion && { docker_version: dockerVersion }),
        ...(osInfo && { os_info: osInfo }),
      }).eq('id', hostId)

      return new Response(JSON.stringify({
        ok,
        status: text,
        docker_version: dockerVersion,
        os_info: osInfo,
        connection_mode: (host as any).connection_mode,
      }), { headers: jsonHeaders })
    }

    // ── Handle logs ──
    if (action === 'container-logs') {
      const rawBytes = new Uint8Array(await dockerResponse.arrayBuffer())
      const lines: string[] = []
      let offset = 0
      while (offset + 8 <= rawBytes.length) {
        const size = (rawBytes[offset + 4] << 24) | (rawBytes[offset + 5] << 16) | (rawBytes[offset + 6] << 8) | rawBytes[offset + 7]
        offset += 8
        if (offset + size <= rawBytes.length) {
          lines.push(new TextDecoder().decode(rawBytes.slice(offset, offset + size)).trimEnd())
        }
        offset += size
      }
      if (lines.length === 0) {
        const text = new TextDecoder().decode(rawBytes)
        lines.push(...text.split('\n').filter(Boolean))
      }
      return new Response(JSON.stringify({ logs: lines }), { headers: jsonHeaders })
    }

    // ── Handle start/stop/restart ──
    if (['container-start', 'container-stop', 'container-restart'].includes(action)) {
      const text = await dockerResponse.text()
      const ok = dockerResponse.status === 204 || dockerResponse.status === 304 || dockerResponse.ok
      return new Response(JSON.stringify({ ok, status: dockerResponse.status, message: text }), { headers: jsonHeaders })
    }

    // ── All other JSON responses ──
    if (!dockerResponse.ok) {
      const errText = await dockerResponse.text()
      return new Response(JSON.stringify({ error: `Docker API error: ${dockerResponse.status}`, details: errText }), {
        status: 502, headers: jsonHeaders
      })
    }

    const data = await dockerResponse.json()
    return new Response(JSON.stringify(data), { headers: jsonHeaders })

  } catch (error: any) {
    const msg = error.message || ''
    return new Response(JSON.stringify({
      error: 'Docker connection failed',
      details: msg,
    }), { status: 502, headers: jsonHeaders })
  }
})
