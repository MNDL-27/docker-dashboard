import { sql } from '../../db.mjs';
import { buildAgentRequest, dockerFetch } from '../client';
import { toFiniteNumber } from '../utils';
import { parseDiagnosticPayload } from '../../../../../../../shared/lib/diagnostics';
import { classifyHostMetricsFailure } from '../errors';
import { createHostMetricsPoint } from '../metrics';
import type { ProxyContext } from '../types';

export async function handleHostMetrics(ctx: ProxyContext) {
  const { host, secrets, auth, corsHeaders, createProblemResponse } = ctx;

  const metricsReq = buildAgentRequest(host, secrets, '/metrics', 'GET');
  const metricsResponse = await dockerFetch(metricsReq.url, metricsReq.method, metricsReq.headers, 5000);

  if (!metricsResponse.ok) {
    const rawDetails = await metricsResponse.text();
    const parsedDetails = parseDiagnosticPayload(rawDetails);
    const failure = classifyHostMetricsFailure(metricsResponse.status || 502, parsedDetails);

    return new Response(JSON.stringify(failure), { status: metricsResponse.status || 502, headers: corsHeaders });
  }

  const metricsData = await metricsResponse.json();

  try {
    await sql`
      UPDATE docker_hosts
      SET status = 'connected', last_seen_at = now()
      WHERE id = ${host.id}
        AND (status != 'connected' OR last_seen_at < now() - interval '1 minute')
    `;
  } catch (e) {
    console.error('[docker-proxy] failed to update host heartbeat', e);
  }

  const currentRx = toFiniteNumber(metricsData.network_rx_total);
  const currentTx = toFiniteNumber(metricsData.network_tx_total);
  const monthBucket = new Date().toISOString().slice(0, 7);

  let monthlyTotal = 0;

  if (currentRx !== null && currentTx !== null) {
    try {
      const usageResult = await sql`
        INSERT INTO host_network_usage (host_id, month_bucket, last_raw_rx, last_raw_tx, accumulated_rx, accumulated_tx)
        VALUES (${host.id}, ${monthBucket}, ${currentRx}, ${currentTx}, 0, 0)
        ON CONFLICT (host_id, month_bucket) DO UPDATE SET
          accumulated_rx = host_network_usage.accumulated_rx + CASE 
            WHEN ${currentRx} >= host_network_usage.last_raw_rx THEN (${currentRx} - host_network_usage.last_raw_rx)
            ELSE ${currentRx}
          END,
          accumulated_tx = host_network_usage.accumulated_tx + CASE 
            WHEN ${currentTx} >= host_network_usage.last_raw_tx THEN (${currentTx} - host_network_usage.last_raw_tx)
            ELSE ${currentTx}
          END,
          last_raw_rx = ${currentRx},
          last_raw_tx = ${currentTx},
          updated_at = now()
        RETURNING accumulated_rx, accumulated_tx;
      `;
      
      if (usageResult.length > 0) {
        monthlyTotal = (toFiniteNumber(usageResult[0].accumulated_rx) ?? 0) + (toFiniteNumber(usageResult[0].accumulated_tx) ?? 0);
      }
    } catch (e) {
      console.error('[docker-proxy] network usage upsert failed', e);
    }
  }

  const normalizedMetrics = createHostMetricsPoint({
    ...metricsData,
    network_monthly_total: monthlyTotal > 0 ? monthlyTotal : null
  });

  if (!normalizedMetrics) {
    return createProblemResponse(502, "Host metrics unavailable", "Agent returned a success response without a usable metrics sample", "malformed_metrics_payload");
  }

  await sql`
    UPDATE docker_hosts
    SET status = 'connected',
        last_seen_at = now()
    WHERE id = ${host.id}
  `;

  return new Response(JSON.stringify(normalizedMetrics), {
    headers: corsHeaders,
  });
}
