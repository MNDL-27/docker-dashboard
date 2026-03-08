import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

/** Build a Deno HTTP client with optional mTLS certs */
function buildHttpClient(tls?: { ca_cert?: string; client_cert?: string; client_key?: string }) {
  const opts: Record<string, unknown> = {}
  if (tls?.ca_cert) opts.caCerts = [tls.ca_cert]
  if (tls?.client_cert && tls?.client_key) {
    opts.certChain = tls.client_cert
    opts.privateKey = tls.client_key
  }
  // Deno.createHttpClient supports mTLS natively
  return Deno.createHttpClient(opts)
}

/** Fetch with optional TLS client, auto-cleanup */
async function dockerFetch(url: string, method: string, tls?: any, timeoutMs = 30000) {
  const client = buildHttpClient(tls)
  try {
    return await fetch(url, { method, signal: AbortSignal.timeout(timeoutMs), client } as any)
  } finally {
    client.close()
  }
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

  // Service client for reading TLS secrets (bypasses RLS)
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  /** Load TLS certs for a host (only via service role) */
  async function loadTls(hostId: string) {
    const { data } = await serviceClient
      .from('docker_host_tls')
      .select('ca_cert, client_cert, client_key, server_name')
      .eq('host_id', hostId)
      .maybeSingle()
    return data || undefined
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
          const tls = host.tls_enabled ? await loadTls(host.id) : undefined
          const resp = await dockerFetch(
            `${host.host_url.replace(/\/$/, '')}/containers/json?all=true`,
            'GET', tls, 10000
          )
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

    // Load TLS certs via service role
    const tls = (host as any).tls_enabled ? await loadTls(hostId) : undefined

    const baseUrl = (host as any).host_url.replace(/\/$/, '')
    let dockerUrl: string
    let method = 'GET'

    switch (action) {
      case 'ping':
        dockerUrl = `${baseUrl}/_ping`
        break
      case 'info':
        dockerUrl = `${baseUrl}/info`
        break
      case 'version':
        dockerUrl = `${baseUrl}/version`
        break
      case 'containers':
        dockerUrl = `${baseUrl}/containers/json?all=true`
        break
      case 'container-inspect':
        if (!containerId) return new Response(JSON.stringify({ error: 'containerId required' }), { status: 400, headers: jsonHeaders })
        dockerUrl = `${baseUrl}/containers/${containerId}/json`
        break
      case 'container-stats':
        if (!containerId) return new Response(JSON.stringify({ error: 'containerId required' }), { status: 400, headers: jsonHeaders })
        dockerUrl = `${baseUrl}/containers/${containerId}/stats?stream=false`
        break
      case 'container-logs':
        if (!containerId) return new Response(JSON.stringify({ error: 'containerId required' }), { status: 400, headers: jsonHeaders })
        const tail = params?.tail || 100
        dockerUrl = `${baseUrl}/containers/${containerId}/logs?stdout=true&stderr=true&tail=${tail}&timestamps=true`
        break
      case 'container-start':
        if (!containerId) return new Response(JSON.stringify({ error: 'containerId required' }), { status: 400, headers: jsonHeaders })
        dockerUrl = `${baseUrl}/containers/${containerId}/start`
        method = 'POST'
        break
      case 'container-stop':
        if (!containerId) return new Response(JSON.stringify({ error: 'containerId required' }), { status: 400, headers: jsonHeaders })
        dockerUrl = `${baseUrl}/containers/${containerId}/stop`
        method = 'POST'
        break
      case 'container-restart':
        if (!containerId) return new Response(JSON.stringify({ error: 'containerId required' }), { status: 400, headers: jsonHeaders })
        dockerUrl = `${baseUrl}/containers/${containerId}/restart`
        method = 'POST'
        break
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: jsonHeaders })
    }

    const dockerResponse = await dockerFetch(dockerUrl, method, tls)

    // ── Handle ping ──
    if (action === 'ping') {
      const text = await dockerResponse.text()
      const ok = dockerResponse.ok

      let dockerVersion = null
      let osInfo = null
      try {
        const vResp = await dockerFetch(`${baseUrl}/version`, 'GET', tls, 5000)
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
        tls_verified: !!(tls?.ca_cert),
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
    // Distinguish TLS errors
    const msg = error.message || ''
    const isTlsError = msg.includes('tls') || msg.includes('certificate') || msg.includes('SSL') || msg.includes('handshake')
    return new Response(JSON.stringify({
      error: isTlsError ? 'TLS connection failed' : 'Docker connection failed',
      details: msg,
    }), { status: 502, headers: jsonHeaders })
  }
})
