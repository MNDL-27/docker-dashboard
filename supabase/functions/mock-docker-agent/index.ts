import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-agent-key, x-docker-socket',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/mock-docker-agent/, '')

  // Read mode from DB
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: config } = await supabase
    .from('mock_agent_config')
    .select('mode')
    .eq('id', 1)
    .single()

  const mode = config?.mode || 'success'

  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }

  if (mode === 'failure') {
    return new Response('Service Unavailable - Mock failure mode', {
      status: 503,
      headers: corsHeaders,
    })
  }

  // Success mode
  if (path === '/docker/_ping' || path.endsWith('/_ping')) {
    return new Response('OK', { status: 200, headers: corsHeaders })
  }

  if (path === '/docker/version' || path.endsWith('/version')) {
    return new Response(JSON.stringify({
      Version: '27.0.3-mock',
      ApiVersion: '1.46',
      Os: 'linux',
      Arch: 'amd64',
      KernelVersion: '6.1.0-mock',
      GoVersion: 'go1.22.0',
    }), { status: 200, headers: jsonHeaders })
  }

  return new Response(JSON.stringify({ error: 'Not found', path }), {
    status: 404,
    headers: jsonHeaders,
  })
})
