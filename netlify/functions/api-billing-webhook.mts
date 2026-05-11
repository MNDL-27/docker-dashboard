import type { Config } from '@netlify/functions';
import { sql } from './lib/db.mjs';
import crypto from 'crypto';
import { applyRateLimit, RATE_LIMITS, verifyWebhookTimestamp, logSecurityEvent, getClientIp } from './lib/security.mjs';
import { enforceOrganizationNodeLimit } from './lib/access-controls.mjs';

const PADDLE_WEBHOOK_SECRET = process.env.PADDLE_WEBHOOK_SECRET;

const verifySignature = (body: string, signature: string): boolean => {
  if (!PADDLE_WEBHOOK_SECRET || !signature) return false;

  // Paddle signature format: ts=1234567;h1=abcdef...
  const parts = signature.split(';');
  const tsPart = parts.find(p => p.startsWith('ts='));
  const h1Part = parts.find(p => p.startsWith('h1='));

  if (!tsPart || !h1Part) return false;

  const ts = tsPart.split('=')[1];
  const h1 = h1Part.split('=')[1];

  const payload = `${ts}:${body}`;
  const cryptoHash = crypto
    .createHmac('sha256', PADDLE_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  return cryptoHash === h1;
};

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Apply rate limiting for webhook endpoint
  const rateLimitResponse = await applyRateLimit(req, 'webhook:paddle', RATE_LIMITS.WEBHOOK);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const signature = req.headers.get('paddle-signature') || '';
  const rawBody = await req.text();
  const clientIp = getClientIp(req);

  // Verify timestamp to prevent replay attacks
  const tsMatch = signature.match(/ts=(\d+)/);
  const timestampHeader = tsMatch ? tsMatch[1] : null;
  const nonceMatch = signature.match(/h1=([a-f0-9]+)/);
  const nonceHeader = nonceMatch ? nonceMatch[1] : null;
  
  const timestampResult = await verifyWebhookTimestamp(timestampHeader, nonceHeader);
  if (!timestampResult.valid) {
    logSecurityEvent({
      type: 'replay_attack',
      endpoint: '/api/billing/webhook',
      ip: clientIp,
      reason: `Timestamp verification failed: ${timestampResult.error}`,
      metadata: { provider: 'paddle' },
    });
    console.error('Invalid Paddle timestamp/nonce:', timestampResult.error);
    return new Response('Invalid Timestamp', { status: 401 });
  }

  if (!verifySignature(rawBody, signature)) {
    logSecurityEvent({
      type: 'webhook_signature_failure',
      endpoint: '/api/billing/webhook',
      ip: clientIp,
      reason: 'Invalid Paddle signature',
      metadata: { provider: 'paddle' },
    });
    console.error('Invalid Paddle signature');
    return new Response('Invalid Signature', { status: 401 });
  }

  try {
    const event = JSON.parse(rawBody);
    const eventType = event.event_type;
    const data = event.data;

    console.log(`Processing Paddle webhook: ${eventType}`, {
      subscription_id: data.id,
      customer_id: data.customer_id
    });

    // Extract organization_id and intended_plan from custom_data
    const { organization_id, intended_plan } = data.custom_data || {};

    if (!organization_id) {
      console.warn('Webhook missing organization_id in custom_data', { event_id: event.event_id });
      // Return 200 to acknowledge receipt even if we can't process it (to avoid retries)
      return new Response('OK - No org_id', { status: 200 });
    }

    // Status mapping: active, past_due, canceled, paused, trial, incomplete
    const status = data.status;
    const paddleSubscriptionId = data.id;
    const paddleCustomerId = data.customer_id;
    const paddlePriceId = data.items?.[0]?.price?.id || null;
    const currentPeriodEndsAt = data.current_period_end || null;
    const cancelAtPeriodEnd = data.scheduled_change?.action === 'cancel' || false;

    // Determine the logical plan name. 
    // We prefer the custom_data.intended_plan if provided during checkout, 
    // otherwise fallback to a generic lookup if needed.
    const plan = intended_plan || 'free';

    // Handle activation: only set active if status is 'active' or 'trialing'
    const isPaidActive = status === 'active' || status === 'trialing';
    
    // For 'subscription.created', we record details but don't necessarily update status yet if not active
    // Most checkouts will trigger 'created' then 'activated' (or just 'activated' with full data)

    await sql`
      UPDATE organizations 
      SET 
        plan = ${isPaidActive ? plan : 'free'},
        subscription_status = ${status},
        paddle_subscription_id = ${paddleSubscriptionId},
        paddle_customer_id = ${paddleCustomerId},
        paddle_price_id = ${paddlePriceId},
        current_period_ends_at = ${currentPeriodEndsAt},
        cancel_at_period_end = ${cancelAtPeriodEnd},
        billing_updated_at = NOW()
      WHERE id = ${organization_id}
    `;

    // Re-evaluate node limit immediately so a downgrade (or cancellation that
    // flips the org back to 'free') locks excess hosts without waiting for the
    // next background poll.
    try {
      await enforceOrganizationNodeLimit({
        organizationId: organization_id,
        isPlatformAdmin: false,
      });
    } catch (enforceError) {
      console.error('Failed to enforce node limit after Paddle webhook update', enforceError);
    }

    return new Response(JSON.stringify({ success: true }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error('Webhook processing error:', err);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config: Config = {
  path: '/api/billing/webhook',
};
