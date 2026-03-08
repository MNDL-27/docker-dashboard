import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

  try {
    const body = await req.json()
    const { action, hostId, orgId, containerId, params } = body

    // Org-wide action: fetch containers from all connected hosts
    if (action === 'all-containers') {
      if (!orgId) {
        return new Response(JSON.stringify({ error: 'orgId required' }), { status: 400, headers: jsonHeaders })
      }

      // Verify membership via RLS (user's token scopes the query)
      const { data: membership } = await supabase
        .from('organization_members')
        .select('id')
        .eq('organization_id', orgId)
        .eq('user_id', userId)
        .maybeSingle()

      if (!membership) {
        return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: jsonHeaders })
      }

      const serviceClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )

      const { data: hosts } = await serviceClient
        .from('docker_hosts')
        .select('*')
        .eq('organization_id', orgId)

      const allContainers: any[] = []
      for (const host of (hosts || [])) {
        try {
          const resp = await fetch(`${host.host_url.replace(/\/$/, '')}/containers/json?all=true`, {
            signal: AbortSignal.timeout(10000),
          })
          if (resp.ok) {
            const containers = await resp.json()
            allContainers.push(...containers.map((c: any) => ({
              ...c,
              _hostId: host.id,
              _hostName: host.name,
            })))
            // Update host status
            await serviceClient.from('docker_hosts').update({
              status: 'connected',
              last_seen_at: new Date().toISOString(),
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

    // Host-specific actions require hostId
    if (!hostId) {
      return new Response(JSON.stringify({ error: 'hostId required' }), { status: 400, headers: jsonHeaders })
    }

    // Fetch host (RLS ensures user has access via org membership)
    const { data: host, error: hostError } = await supabase
      .from('docker_hosts')
      .select('*')
      .eq('id', hostId)
      .single()

    if (hostError || !host) {
      return new Response(JSON.stringify({ error: 'Host not found or access denied' }), { status: 404, headers: jsonHeaders })
    }

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

    const dockerResponse = await fetch(dockerUrl, {
      method,
      signal: AbortSignal.timeout(30000),
    })

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Handle ping
    if (action === 'ping') {
      const text = await dockerResponse.text()
      const ok = dockerResponse.ok

      // Try to get version info too
      let dockerVersion = null
      let osInfo = null
      try {
        const vResp = await fetch(`${baseUrl}/version`, { signal: AbortSignal.timeout(5000) })
        if (vResp.ok) {
          const vData = await vResp.json()
          dockerVersion = vData.Version || null
          osInfo = vData.Os ? `${vData.Os}/${vData.Arch}` : null
        } else {
          await vResp.text()
        }
      } catch (_) { /* ignore */ }

      await serviceClient.from('docker_hosts').update({
        status: ok ? 'connected' : 'error',
        last_seen_at: new Date().toISOString(),
        ...(dockerVersion && { docker_version: dockerVersion }),
        ...(osInfo && { os_info: osInfo }),
      }).eq('id', hostId)

      return new Response(JSON.stringify({ ok, status: text, docker_version: dockerVersion, os_info: osInfo }), { headers: jsonHeaders })
    }

    // Handle logs (raw text)
    if (action === 'container-logs') {
      const rawBytes = new Uint8Array(await dockerResponse.arrayBuffer())
      // Docker multiplexed stream: strip 8-byte header frames
      const lines: string[] = []
      let offset = 0
      while (offset + 8 <= rawBytes.length) {
        const size = (rawBytes[offset + 4] << 24) | (rawBytes[offset + 5] << 16) | (rawBytes[offset + 6] << 8) | rawBytes[offset + 7]
        offset += 8
        if (offset + size <= rawBytes.length) {
          const line = new TextDecoder().decode(rawBytes.slice(offset, offset + size))
          lines.push(line.trimEnd())
        }
        offset += size
      }
      // Fallback: if parsing produced nothing, treat as plain text
      if (lines.length === 0) {
        const text = new TextDecoder().decode(rawBytes)
        lines.push(...text.split('\n').filter(Boolean))
      }
      return new Response(JSON.stringify({ logs: lines }), { headers: jsonHeaders })
    }

    // Handle start/stop/restart (204 or 304 = success)
    if (['container-start', 'container-stop', 'container-restart'].includes(action)) {
      const text = await dockerResponse.text()
      const ok = dockerResponse.status === 204 || dockerResponse.status === 304 || dockerResponse.ok
      return new Response(JSON.stringify({ ok, status: dockerResponse.status, message: text }), { headers: jsonHeaders })
    }

    // All other JSON responses
    if (!dockerResponse.ok) {
      const errText = await dockerResponse.text()
      return new Response(JSON.stringify({ error: `Docker API error: ${dockerResponse.status}`, details: errText }), {
        status: 502, headers: jsonHeaders
      })
    }

    const data = await dockerResponse.json()
    return new Response(JSON.stringify(data), { headers: jsonHeaders })

  } catch (error: any) {
    return new Response(JSON.stringify({
      error: 'Docker connection failed',
      details: error.message,
    }), { status: 502, headers: jsonHeaders })
  }
})
