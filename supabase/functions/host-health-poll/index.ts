import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const UNHEALTHY_THRESHOLD = 3
const PING_TIMEOUT_MS = 10000

function buildPingRequest(
  host: { host_url: string; connection_mode: string; docker_socket_path: string | null },
  secrets: { agent_api_key?: string; cf_service_token_id?: string; cf_service_token_secret?: string } | null,
) {
  const base = host.host_url.replace(/\/$/, '')
  const headers: Record<string, string> = {}

  if (secrets?.agent_api_key) {
    headers['X-Agent-Key'] = secrets.agent_api_key
  }

  if (host.docker_socket_path && host.docker_socket_path !== '/var/run/docker.sock') {
    headers['X-Docker-Socket'] = host.docker_socket_path
  }

  if (host.connection_mode === 'cloudflare_tunnel') {
    if (secrets?.cf_service_token_id) headers['CF-Access-Client-Id'] = secrets.cf_service_token_id
    if (secrets?.cf_service_token_secret) headers['CF-Access-Client-Secret'] = secrets.cf_service_token_secret
  }

  return { pingUrl: `${base}/docker/_ping`, versionUrl: `${base}/docker/version`, headers }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }

  // This function is called by pg_cron — authenticate via Authorization header matching anon key
  // or service role. We verify_jwt = false in config.toml, so we just proceed with service role.
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    // Fetch all hosts
    const { data: hosts, error: hostsError } = await serviceClient
      .from('docker_hosts')
      .select('*')

    if (hostsError) {
      return new Response(JSON.stringify({ error: hostsError.message }), { status: 500, headers: jsonHeaders })
    }

    if (!hosts || hosts.length === 0) {
      return new Response(JSON.stringify({ polled: 0, message: 'No hosts to poll' }), { headers: jsonHeaders })
    }

    const results: { hostId: string; name: string; status: string; error?: string }[] = []

    // Poll each host concurrently with Promise.allSettled
    await Promise.allSettled(hosts.map(async (host: any) => {
      const hostId = host.id
      const hostName = host.name

      try {
        // Load secrets
        const { data: secrets } = await serviceClient
          .from('docker_host_secrets')
          .select('agent_api_key, cf_service_token_id, cf_service_token_secret')
          .eq('host_id', hostId)
          .maybeSingle()

        const { pingUrl, versionUrl, headers } = buildPingRequest(host, secrets)

        // Ping
        const pingResp = await fetch(pingUrl, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(PING_TIMEOUT_MS),
        })

        if (!pingResp.ok) {
          const errText = await pingResp.text()
          throw new Error(`Ping returned ${pingResp.status}: ${errText}`)
        }
        await pingResp.text() // consume body

        // Try to get version info
        let dockerVersion: string | null = null
        let osInfo: string | null = null
        try {
          const vResp = await fetch(versionUrl, {
            method: 'GET',
            headers,
            signal: AbortSignal.timeout(5000),
          })
          if (vResp.ok) {
            const vData = await vResp.json()
            dockerVersion = vData.Version || null
            osInfo = vData.Os ? `${vData.Os}/${vData.Arch}` : null
          } else {
            await vResp.text()
          }
        } catch (_) { /* version fetch is best-effort */ }

        // Success — reset failures
        await serviceClient.from('docker_hosts').update({
          status: 'connected',
          last_seen_at: new Date().toISOString(),
          consecutive_failures: 0,
          last_error: null,
          ...(dockerVersion && { docker_version: dockerVersion }),
          ...(osInfo && { os_info: osInfo }),
        }).eq('id', hostId)

        results.push({ hostId, name: hostName, status: 'connected' })

      } catch (err: any) {
        const errorMsg = err.message || 'Unknown error'
        const newFailures = (host.consecutive_failures || 0) + 1
        const newStatus = newFailures >= UNHEALTHY_THRESHOLD ? 'unhealthy' : 'error'

        await serviceClient.from('docker_hosts').update({
          status: newStatus,
          consecutive_failures: newFailures,
          last_error: errorMsg.substring(0, 500),
        }).eq('id', hostId)

        results.push({ hostId, name: hostName, status: newStatus, error: errorMsg })
      }
    }))

    return new Response(JSON.stringify({
      polled: hosts.length,
      results,
      timestamp: new Date().toISOString(),
    }), { headers: jsonHeaders })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: jsonHeaders })
  }
})
