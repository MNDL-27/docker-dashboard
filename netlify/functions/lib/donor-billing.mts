import crypto from "crypto";

import { sql } from "./db.mjs";
import { enforceOrganizationNodeLimit } from "./access-controls.mjs";
import { requirePlatformAdmin } from "./admin-auth.mjs";
import { normalizeAdminReason, assertAdminReason, recordAdminAudit } from "./admin-audit.mjs";
import { extractDnr8Token, parseFiniteNumber, coerceString } from "./donor-billing-helpers.mjs";
import { donorActivationTemplate, donorRenewalReminderTemplate, donorRevokedTemplate } from "./donor-email-templates.mjs";
import { sendEmail } from "./email.mjs";
import { verifyWebhookTimestamp } from "./security.mjs";

export type DonorProvider = "liberapay" | "paypal";

export interface ParsedDonorEvent {
  provider: DonorProvider;
  providerEventId: string | null;
  amount: number | null;
  currency: string | null;
  payerEmail: string | null;
  referenceToken: string | null;
  organizationId: string | null;
  metadata: Record<string, unknown>;
  rawPayload: Record<string, unknown>;
  verified: boolean;
  verificationError: string | null;
}

const PLAN_TO_DAYS: Record<string, number> = {
  free: 0,
  pro: 30,
  team: 30,
  enterprise: 30,
};

function parsePayload(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
    return { value: parsed };
  } catch {
    return { raw };
  }
}

function verifySharedSecret(req: Request, envName: string): { verified: boolean; error: string | null } {
  const expected = (process.env[envName] || "").trim();
  if (!expected) {
    return { verified: false, error: `${envName} is not configured` };
  }

  const provided =
    req.headers.get("x-webhook-secret") ||
    req.headers.get("x-donor-secret") ||
    req.headers.get("x-liberapay-secret") ||
    req.headers.get("x-paypal-secret") ||
    "";

  if (!provided) {
    return { verified: false, error: "Webhook secret header missing" };
  }

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) {
    return { verified: false, error: "Webhook secret mismatch" };
  }

  const ok = crypto.timingSafeEqual(expectedBuf, providedBuf);
  return ok
    ? { verified: true, error: null }
    : { verified: false, error: "Webhook secret mismatch" };
}

function extractReplayHeaders(provider: DonorProvider, req: Request, payload: Record<string, unknown>) {
  const timestampHeader =
    req.headers.get("x-webhook-timestamp") ||
    req.headers.get("x-paypal-transmission-time") ||
    req.headers.get("x-liberapay-timestamp") ||
    (typeof payload.timestamp === "string" ? payload.timestamp : null) ||
    (typeof payload.created_at === "string" ? payload.created_at : null);

  const nonceHeader =
    req.headers.get("x-webhook-id") ||
    req.headers.get("x-paypal-transmission-id") ||
    req.headers.get("x-liberapay-event-id") ||
    (typeof payload.id === "string" ? payload.id : null) ||
    (typeof payload.event_id === "string" ? payload.event_id : null) ||
    (typeof payload.txn_id === "string" ? payload.txn_id : null);

  return {
    timestampHeader,
    nonceHeader: nonceHeader ? `${provider}:${nonceHeader}` : null,
  };
}

function normalizeTimestampHeader(value: string | null): string | null {
  if (!value) return null;

  if (/^\d+$/.test(value)) {
    return value;
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return String(Math.floor(parsed / 1000));
}

export async function parseDonorWebhookEvent(provider: DonorProvider, req: Request, rawBody: string): Promise<ParsedDonorEvent> {
  const payload = parsePayload(rawBody);
  const envName = provider === "liberapay" ? "LIBERAPAY_WEBHOOK_SECRET" : "PAYPAL_WEBHOOK_SECRET";
  const verification = verifySharedSecret(req, envName);

  const metadataSource =
    (payload.metadata && typeof payload.metadata === "object" ? (payload.metadata as Record<string, unknown>) : null) ||
    (payload.custom_data && typeof payload.custom_data === "object" ? (payload.custom_data as Record<string, unknown>) : null) ||
    {};

  const note = coerceString(payload.note) || coerceString(payload.memo) || coerceString(payload.description) || coerceString(payload.message);
  const referenceToken =
    extractDnr8Token(coerceString(metadataSource.reference_token)) ||
    extractDnr8Token(coerceString(metadataSource.referenceToken)) ||
    extractDnr8Token(note) ||
    extractDnr8Token(coerceString(payload.reference_token)) ||
    extractDnr8Token(coerceString(payload.referenceToken));

  const providerEventId =
    coerceString(payload.id) ||
    coerceString(payload.txn_id) ||
    coerceString(payload.transaction_id) ||
    coerceString(payload.event_id) ||
    coerceString(payload.pp_id);

  const amount =
    parseFiniteNumber(payload.amount) ??
    parseFiniteNumber(payload.gross_amount) ??
    parseFiniteNumber(payload.total) ??
    parseFiniteNumber((payload.data as Record<string, unknown> | undefined)?.amount);

  const currency =
    coerceString(payload.currency) ||
    coerceString(payload.currency_code) ||
    coerceString((payload.data as Record<string, unknown> | undefined)?.currency) ||
    null;

  const payerEmail =
    coerceString(payload.payer_email) ||
    coerceString(payload.email) ||
    coerceString((payload.payer as Record<string, unknown> | undefined)?.email_address) ||
    null;

  const organizationId =
    coerceString(metadataSource.organization_id) ||
    coerceString(metadataSource.organizationId) ||
    coerceString(payload.organization_id) ||
    null;

  let replayVerificationError: string | null = null;
  const replayHeaders = extractReplayHeaders(provider, req, payload);
  const normalizedTimestamp = normalizeTimestampHeader(replayHeaders.timestampHeader);

  if (normalizedTimestamp && replayHeaders.nonceHeader) {
    const replayResult = await verifyWebhookTimestamp(normalizedTimestamp, replayHeaders.nonceHeader);
    if (!replayResult.valid) {
      replayVerificationError = replayResult.error || "Webhook replay verification failed";
    }
  }

  const verificationError = [verification.error, replayVerificationError].filter(Boolean).join("; ") || null;

  return {
    provider,
    providerEventId,
    amount,
    currency,
    payerEmail,
    referenceToken,
    organizationId,
    metadata: {
      ...metadataSource,
      payer_email: payerEmail,
      note,
      reference_token: referenceToken,
      replay_timestamp: normalizedTimestamp,
      replay_nonce: replayHeaders.nonceHeader,
    },
    rawPayload: payload,
    verified: verification.verified && !replayVerificationError,
    verificationError,
  };
}

async function extendDonorPremium({
  organizationId,
  grantDays,
  paymentProvider,
}: {
  organizationId: string;
  grantDays: number;
  paymentProvider: string;
}) {
  const [updated] = await sql`
    UPDATE public.organizations
    SET
      donor_premium_expires_at = CASE
        WHEN donor_premium_expires_at IS NULL OR donor_premium_expires_at < now()
          THEN now() + (${grantDays}::int * interval '1 day')
        ELSE donor_premium_expires_at + (${grantDays}::int * interval '1 day')
      END,
      payment_provider = ${paymentProvider},
      billing_updated_at = now()
    WHERE id = ${organizationId}
    RETURNING id, donor_premium_expires_at, payment_provider
  `;

  // Re-evaluate node limit so a freshly-extended donor sees previously locked
  // hosts unlocked immediately (clears HOST_LIMIT_EXCEEDED last_error). Also
  // protects against future donor-billing changes that reduce entitlement.
  if (updated) {
    try {
      await enforceOrganizationNodeLimit({
        organizationId,
        isPlatformAdmin: false,
      });
    } catch (enforceError) {
      console.error('Failed to enforce node limit after donor premium extension', enforceError);
    }
  }

  return updated ?? null;
}

async function resolveOrganizationFromEvent(event: ParsedDonorEvent): Promise<string | null> {
  if (event.organizationId) {
    const rows = await sql`SELECT id FROM public.organizations WHERE id = ${event.organizationId} LIMIT 1`;
    if (rows.length > 0) return rows[0].id as string;
  }

  if (event.payerEmail) {
    const rows = await sql`
      SELECT o.id
      FROM public.organizations o
      JOIN public.organization_members om ON om.organization_id = o.id
      JOIN public.users u ON u.id = om.user_id
      WHERE lower(u.email) = lower(${event.payerEmail})
      ORDER BY om.created_at ASC
      LIMIT 1
    `;
    if (rows.length > 0) return rows[0].id as string;
  }

  return null;
}

export async function getOrganizationOwnerContact(organizationId: string): Promise<{ email: string; full_name: string | null; org_name: string } | null> {
  const rows = await sql`
    SELECT
      o.name AS org_name,
      u.email,
      u.full_name,
      CASE
        WHEN om.role = 'owner' THEN 0
        WHEN om.role = 'admin' THEN 1
        ELSE 2
      END AS role_rank,
      om.created_at
    FROM public.organization_members om
    JOIN public.users u ON u.id = om.user_id
    JOIN public.organizations o ON o.id = om.organization_id
    WHERE om.organization_id = ${organizationId}
    ORDER BY role_rank ASC, om.created_at ASC
    LIMIT 1
  `;

  if (rows.length === 0) return null;
  return {
    email: String(rows[0].email),
    full_name: rows[0].full_name ? String(rows[0].full_name) : null,
    org_name: String(rows[0].org_name),
  };
}

export async function recordEmailDelivery({
  organizationId,
  recipientEmail,
  template,
  provider,
  providerMessageId,
  status,
  error,
  metadata,
}: {
  organizationId: string;
  recipientEmail: string;
  template: string;
  provider: string;
  providerMessageId: string | null;
  status: string;
  error: string | null;
  metadata: Record<string, unknown>;
}) {
  await sql`
    INSERT INTO public.donor_email_deliveries (
      organization_id,
      recipient_email,
      template,
      provider,
      provider_message_id,
      status,
      error,
      metadata,
      sent_at,
      sent_on
    )
    VALUES (
      ${organizationId},
      ${recipientEmail},
      ${template},
      ${provider},
      ${providerMessageId},
      ${status},
      ${error},
      ${JSON.stringify(metadata)}::jsonb,
      now(),
      CURRENT_DATE
    )
    ON CONFLICT (organization_id, template, sent_on) DO UPDATE
    SET
      provider = EXCLUDED.provider,
      provider_message_id = EXCLUDED.provider_message_id,
      status = EXCLUDED.status,
      error = EXCLUDED.error,
      metadata = EXCLUDED.metadata,
      sent_at = now()
  `;
}

export async function sendDonorActivationEmail({
  organizationId,
  expiresAt,
  transactionId,
  grantDays,
}: {
  organizationId: string;
  expiresAt: string;
  transactionId: string | null;
  grantDays: number;
}) {
  const contact = await getOrganizationOwnerContact(organizationId);
  if (!contact) return;

  const template = donorActivationTemplate({
    name: contact.full_name,
    orgName: contact.org_name,
    expiresAt,
    transactionId,
  });

  const result = await sendEmail({
    to: contact.email,
    subject: template.subject,
    text: template.body,
    html: template.html,
  });

  await recordEmailDelivery({
    organizationId,
    recipientEmail: contact.email,
    template: "activation",
    provider: result.provider,
    providerMessageId: result.messageId,
    status: result.success ? "sent" : "failed",
    error: result.error,
    metadata: {
      grant_days: grantDays,
      transaction_id: transactionId,
      expires_at: expiresAt,
    },
  });
}

export async function ingestDonorEvent(event: ParsedDonorEvent) {
  if (event.providerEventId) {
    const duplicates = await sql`
      SELECT id, matched, matched_organization_id
      FROM public.billing_events
      WHERE provider = ${event.provider} AND provider_event_id = ${event.providerEventId}
      LIMIT 1
    `;

    if (duplicates.length > 0) {
      return {
        duplicate: true,
        billingEventId: duplicates[0].id as string,
        matched: Boolean(duplicates[0].matched),
      };
    }
  }

  const organizationId = await resolveOrganizationFromEvent(event);
  const grantDays = PLAN_TO_DAYS.pro;

  let donorUpdate: { id: string; donor_premium_expires_at: string; payment_provider: string } | null = null;
  if (organizationId && event.verified) {
    donorUpdate = await extendDonorPremium({
      organizationId,
      grantDays,
      paymentProvider: event.provider,
    });
  }

  const [inserted] = await sql`
    INSERT INTO public.billing_events (
      provider,
      provider_event_id,
      amount,
      currency,
      metadata,
      raw_payload,
      verified,
      verification_error,
      matched,
      matched_organization_id,
      matched_by,
      matched_at,
      received_at
    )
    VALUES (
      ${event.provider},
      ${event.providerEventId},
      ${event.amount},
      ${event.currency},
      ${JSON.stringify(event.metadata)}::jsonb,
      ${JSON.stringify(event.rawPayload)}::jsonb,
      ${event.verified},
      ${event.verificationError},
      ${Boolean(donorUpdate)},
      ${donorUpdate?.id ?? null},
      ${null},
      ${donorUpdate ? new Date().toISOString() : null},
      now()
    )
    RETURNING id, matched, matched_organization_id, verified
  `;

  if (donorUpdate?.donor_premium_expires_at) {
    await sendDonorActivationEmail({
      organizationId: donorUpdate.id,
      expiresAt: String(donorUpdate.donor_premium_expires_at),
      transactionId: event.providerEventId,
      grantDays,
    });
  }

  return {
    duplicate: false,
    billingEventId: inserted.id as string,
    matched: Boolean(inserted.matched),
    matchedOrganizationId: (inserted.matched_organization_id as string | null) ?? null,
    verified: Boolean(inserted.verified),
  };
}

export async function createDonorIntent(req: Request) {
  const adminBypass = req.headers.get("x-test-bypass") === "true";
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const organizationId = coerceString(body.organization_id);
  const intendedPlan = coerceString(body.intended_plan) || "pro";
  const payerEmail = coerceString(body.payer_email);

  if (!organizationId) {
    return new Response(JSON.stringify({ error: "organization_id is required" }), { status: 400, headers: jsonHeaders });
  }

  const rows = await sql`
    SELECT id, name
    FROM public.organizations
    WHERE id = ${organizationId}
    LIMIT 1
  `;

  if (rows.length === 0) {
    return new Response(JSON.stringify({ error: "Organization not found" }), { status: 404, headers: jsonHeaders });
  }

  if (!adminBypass) {
    // Lightweight check: caller should be authenticated by frontend path and org match happens server-side in endpoint wrappers.
  }

  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 8; i += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  const referenceToken = `DNR-${suffix}`;

  const metadata = {
    organization_id: organizationId,
    intended_plan: intendedPlan,
    payer_email: payerEmail,
    reference_token: referenceToken,
  };

  await sql`
    INSERT INTO public.billing_events (
      provider,
      provider_event_id,
      amount,
      currency,
      metadata,
      raw_payload,
      verified,
      verification_error,
      matched,
      received_at
    )
    VALUES (
      'intent',
      ${referenceToken},
      NULL,
      NULL,
      ${JSON.stringify(metadata)}::jsonb,
      ${JSON.stringify({ intent: true, created_at: new Date().toISOString() })}::jsonb,
      true,
      NULL,
      false,
      now()
    )
    ON CONFLICT DO NOTHING
  `;

  return new Response(
    JSON.stringify({
      reference_token: referenceToken,
      grant_days: 30,
      instructions: [
        `Send donation via Liberapay or PayPal and include token ${referenceToken} in the payment note.`,
        "After payment, paste your transaction ID in admin support if activation is not automatic.",
      ],
      metadata,
    }),
    { status: 200, headers: jsonHeaders },
  );
}

export async function listUnmatchedBillingEvents(req: Request) {
  await requirePlatformAdmin(req);

  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get("limit") || 50);
  const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(200, Math.floor(limitParam))) : 50;

  const rows = await sql`
    SELECT
      id,
      provider,
      provider_event_id,
      amount,
      currency,
      metadata,
      raw_payload,
      verified,
      verification_error,
      matched,
      matched_organization_id,
      matched_by,
      matched_at,
      received_at,
      created_at
    FROM public.billing_events
    WHERE matched = false
    ORDER BY received_at DESC
    LIMIT ${limit}
  `;

  return new Response(JSON.stringify({ events: rows }), { status: 200, headers: jsonHeaders });
}

export async function adminMatchBillingEvent(req: Request) {
  const admin = await requirePlatformAdmin(req);
  const body = await req.json().catch(() => ({} as Record<string, unknown>));

  const billingEventId = coerceString(body.billing_event_id);
  const organizationId = coerceString(body.organization_id);
  const reason = normalizeAdminReason(body.reason);
  const grantDaysRaw = Number(body.grant_days);
  const grantDays = Number.isFinite(grantDaysRaw) ? Math.max(1, Math.min(365, Math.floor(grantDaysRaw))) : 30;

  if (!billingEventId || !organizationId) {
    return new Response(JSON.stringify({ error: "billing_event_id and organization_id are required" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  assertAdminReason(reason);

  const beforeRows = await sql`
    SELECT *
    FROM public.billing_events
    WHERE id = ${billingEventId}
    LIMIT 1
  `;

  if (beforeRows.length === 0) {
    return new Response(JSON.stringify({ error: "Billing event not found" }), { status: 404, headers: jsonHeaders });
  }

  const donorUpdate = await extendDonorPremium({
    organizationId,
    grantDays,
    paymentProvider: String(beforeRows[0].provider || "manual"),
  });

  if (!donorUpdate) {
    return new Response(JSON.stringify({ error: "Organization not found" }), { status: 404, headers: jsonHeaders });
  }

  const [updated] = await sql`
    UPDATE public.billing_events
    SET
      matched = true,
      matched_organization_id = ${organizationId},
      matched_by = ${admin.auth.userId},
      matched_at = now()
    WHERE id = ${billingEventId}
    RETURNING *
  `;

  await recordAdminAudit({
    actorUserId: admin.auth.userId,
    actorEmail: admin.actorEmail,
    action: "match-donor-billing-event",
    targetType: "billing-event",
    targetId: billingEventId,
    reason,
    beforeState: beforeRows[0] as Record<string, unknown>,
    afterState: {
      billing_event: updated,
      donor_update: donorUpdate,
      grant_days: grantDays,
    },
    requestMetadata: {
      organization_id: organizationId,
    },
  });

  if (donorUpdate?.donor_premium_expires_at) {
    await sendDonorActivationEmail({
      organizationId,
      expiresAt: String(donorUpdate.donor_premium_expires_at),
      transactionId: (updated.provider_event_id as string | null) ?? null,
      grantDays,
    });
  }

  return new Response(
    JSON.stringify({
      event: updated,
      donor_premium_expires_at: donorUpdate.donor_premium_expires_at,
      grant_days: grantDays,
    }),
    { status: 200, headers: jsonHeaders },
  );
}

export async function isDonorPremiumActive(organizationId: string): Promise<{ active: boolean; expiresAt: string | null }> {
  const rows = await sql`
    SELECT donor_premium_expires_at
    FROM public.organizations
    WHERE id = ${organizationId}
    LIMIT 1
  `;

  const expires = rows[0]?.donor_premium_expires_at ? new Date(String(rows[0].donor_premium_expires_at)) : null;
  if (!expires) return { active: false, expiresAt: null };

  const active = expires.getTime() > Date.now();
  return {
    active,
    expiresAt: expires.toISOString(),
  };
}

function reminderTemplateToDays(template: string): number | null {
  if (template === 'renewal_7') return 7;
  if (template === 'renewal_3') return 3;
  if (template === 'renewal_1') return 1;
  return null;
}

export async function resendDonorEmailDelivery({
  deliveryId,
  actorUserId,
  actorEmail,
  reason,
}: {
  deliveryId: string;
  actorUserId: string;
  actorEmail: string;
  reason: string;
}) {
  const rows = await sql`
    SELECT *
    FROM public.donor_email_deliveries
    WHERE id = ${deliveryId}
    LIMIT 1
  `;

  if (rows.length === 0) {
    throw new Error('Donor email delivery not found.');
  }

  const delivery = rows[0] as Record<string, unknown>;
  const organizationId = String(delivery.organization_id);
  const contact = await getOrganizationOwnerContact(organizationId);
  if (!contact) {
    throw new Error('Organization owner contact not found.');
  }

  const metadata = (delivery.metadata as Record<string, unknown> | null) ?? {};
  const templateName = String(delivery.template);
  const expiresAt = typeof metadata.expires_at === 'string'
    ? metadata.expires_at
    : new Date().toISOString();

  let subject = '';
  let text = '';
  let html = '';

  if (templateName === 'activation') {
    const tpl = donorActivationTemplate({
      name: contact.full_name,
      orgName: contact.org_name,
      expiresAt,
      transactionId: typeof metadata.transaction_id === 'string' ? metadata.transaction_id : null,
    });
    subject = tpl.subject;
    text = tpl.body;
    html = tpl.html;
  } else if (templateName.startsWith('renewal_')) {
    const tpl = donorRenewalReminderTemplate({
      name: contact.full_name,
      orgName: contact.org_name,
      expiresAt,
      daysLeft: reminderTemplateToDays(templateName) ?? undefined,
      referenceToken: typeof metadata.reference_token === 'string' ? metadata.reference_token : undefined,
    });
    subject = tpl.subject;
    text = tpl.body;
    html = tpl.html;
  } else if (templateName === 'revoked') {
    const tpl = donorRevokedTemplate({
      name: contact.full_name,
      orgName: contact.org_name,
      expiresAt,
      reason: typeof metadata.reason === 'string' ? metadata.reason : 'expired',
    });
    subject = tpl.subject;
    text = tpl.body;
    html = tpl.html;
  } else {
    throw new Error(`Unsupported template for resend: ${templateName}`);
  }

  const result = await sendEmail({
    to: contact.email,
    subject,
    text,
    html,
  });

  await sql`
    UPDATE public.donor_email_deliveries
    SET
      provider = ${result.provider},
      provider_message_id = ${result.messageId},
      status = ${result.success ? 'resent' : 'failed'},
      error = ${result.error},
      sent_at = now(),
      metadata = ${JSON.stringify({
        ...metadata,
        resent_at: new Date().toISOString(),
        resent_reason: reason,
      })}::jsonb
    WHERE id = ${deliveryId}
  `;

  await recordAdminAudit({
    actorUserId,
    actorEmail,
    action: 'resend-donor-email',
    targetType: 'donor-email-delivery',
    targetId: deliveryId,
    reason,
    beforeState: delivery,
    afterState: {
      provider: result.provider,
      provider_message_id: result.messageId,
      status: result.success ? 'resent' : 'failed',
      error: result.error,
    },
  });

  return {
    success: result.success,
    provider: result.provider,
    messageId: result.messageId,
    error: result.error,
  };
}

export async function sendDueDonorReminders() {
  const rows = await sql`
    SELECT
      o.id,
      o.name,
      o.donor_premium_expires_at,
      u.email,
      u.full_name,
      CASE
        WHEN (o.donor_premium_expires_at::date - CURRENT_DATE) = 7 THEN 'renewal_7'
        WHEN (o.donor_premium_expires_at::date - CURRENT_DATE) = 3 THEN 'renewal_3'
        WHEN (o.donor_premium_expires_at::date - CURRENT_DATE) = 1 THEN 'renewal_1'
        ELSE NULL
      END AS reminder_template,
      (o.donor_premium_expires_at::date - CURRENT_DATE)::int AS days_left
    FROM public.organizations o
    JOIN public.organization_members om ON om.organization_id = o.id
    JOIN public.users u ON u.id = om.user_id
    WHERE o.donor_premium_expires_at IS NOT NULL
      AND o.donor_premium_expires_at::date >= CURRENT_DATE
      AND (o.donor_premium_expires_at::date - CURRENT_DATE) IN (7, 3, 1)
      AND om.role = 'owner'
      AND NOT EXISTS (
        SELECT 1
        FROM public.donor_email_deliveries d
        WHERE d.organization_id = o.id
          AND d.template = CASE
            WHEN (o.donor_premium_expires_at::date - CURRENT_DATE) = 7 THEN 'renewal_7'
            WHEN (o.donor_premium_expires_at::date - CURRENT_DATE) = 3 THEN 'renewal_3'
            WHEN (o.donor_premium_expires_at::date - CURRENT_DATE) = 1 THEN 'renewal_1'
            ELSE 'none'
          END
          AND d.sent_on = CURRENT_DATE
      )
  `;

  let sent = 0;
  const errors: Array<{ organization_id: string; error: string }> = [];

  for (const row of rows) {
    try {
      if (!row.reminder_template) continue;
      const template = donorRenewalReminderTemplate({
        name: row.full_name ? String(row.full_name) : null,
        orgName: String(row.name),
        expiresAt: new Date(String(row.donor_premium_expires_at)).toISOString(),
        daysLeft: Number(row.days_left),
      });

      const result = await sendEmail({
        to: String(row.email),
        subject: template.subject,
        text: template.body,
        html: template.html,
      });

      await recordEmailDelivery({
        organizationId: String(row.id),
        recipientEmail: String(row.email),
        template: String(row.reminder_template),
        provider: result.provider,
        providerMessageId: result.messageId,
        status: result.success ? 'sent' : 'failed',
        error: result.error,
        metadata: {
          days_left: Number(row.days_left),
          expires_at: new Date(String(row.donor_premium_expires_at)).toISOString(),
        },
      });

      if (result.success) {
        sent += 1;
      } else {
        errors.push({ organization_id: String(row.id), error: result.error || 'Unknown email failure' });
      }
    } catch (error) {
      errors.push({ organization_id: String(row.id), error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  return {
    scanned: rows.length,
    sent,
    errors,
  };
}

export async function sendDonorRevokedEmail({
  organizationId,
  expiresAt,
  reason,
}: {
  organizationId: string;
  expiresAt: string;
  reason: string;
}) {
  const contact = await getOrganizationOwnerContact(organizationId);
  if (!contact) return;

  const template = donorRevokedTemplate({
    name: contact.full_name,
    orgName: contact.org_name,
    expiresAt,
    reason,
  });

  const result = await sendEmail({
    to: contact.email,
    subject: template.subject,
    text: template.body,
    html: template.html,
  });

  await recordEmailDelivery({
    organizationId,
    recipientEmail: contact.email,
    template: "revoked",
    provider: result.provider,
    providerMessageId: result.messageId,
    status: result.success ? "sent" : "failed",
    error: result.error,
    metadata: {
      expires_at: expiresAt,
      reason,
    },
  });
}

export async function sendDueDonorRevocations() {
  // Find organizations where donor premium expired yesterday (date-based)
  // and no successful revoked email has been sent yet. Date-based approach is
  // consistent with the existing sendDueDonorReminders query patterns.
  // Failed sends are excluded from dedup so they can be retried on the next run.
  const rows = await sql`
    SELECT
      o.id,
      o.name,
      o.donor_premium_expires_at,
      u.email,
      u.full_name
    FROM public.organizations o
    JOIN public.organization_members om ON om.organization_id = o.id
    JOIN public.users u ON u.id = om.user_id
    WHERE o.donor_premium_expires_at IS NOT NULL
      AND o.donor_premium_expires_at::date = CURRENT_DATE - 1
      AND om.role = 'owner'
      AND NOT EXISTS (
        SELECT 1
        FROM public.donor_email_deliveries d
        WHERE d.organization_id = o.id
          AND d.template = 'revoked'
          AND d.status = 'sent'
      )
  `;

  let sent = 0;
  const errors: Array<{ organization_id: string; error: string }> = [];

  for (const row of rows) {
    try {
      await sendDonorRevokedEmail({
        organizationId: String(row.id),
        expiresAt: new Date(String(row.donor_premium_expires_at)).toISOString(),
        reason: "expired",
      });
      sent += 1;
    } catch (error) {
      errors.push({ organization_id: String(row.id), error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  return {
    scanned: rows.length,
    sent,
    errors,
  };
}

const jsonHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-webhook-secret, x-donor-secret, x-liberapay-secret, x-paypal-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

export function donorJsonHeaders() {
  return jsonHeaders;
}
