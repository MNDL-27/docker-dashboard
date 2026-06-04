import { prisma } from '../lib/prisma';
import crypto from 'crypto';

export interface WebhookPayload {
    event: string;
    alert_id?: string;
    incident_id?: string;
    rule_name: string;
    container_name?: string;
    host_name?: string;
    organization_id: string;
    project_id?: string | null;
    details?: any;
    timestamp: string;
}

/**
 * Dispatch webhook notifications for an event.
 */
export async function dispatchWebhooks(
    organizationId: string,
    projectId: string | null | undefined,
    payload: Omit<WebhookPayload, 'organization_id' | 'timestamp'>
): Promise<void> {
    try {
        const webhooks = await prisma.webhook.findMany({
            where: {
                organizationId: organizationId,
                isActive: true,
                OR: [
                    { projectId: null },
                    { projectId: projectId || undefined }
                ]
            },
        });

        if (webhooks.length === 0) return;

        const fullPayload: WebhookPayload = {
            ...payload,
            organization_id: organizationId,
            project_id: projectId,
            timestamp: new Date().toISOString(),
        };

        const body = JSON.stringify(fullPayload);

        for (const webhook of webhooks) {
            try {
                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                };

                // HMAC signature if secret is configured
                if (webhook.secret) {
                    const signature = crypto
                        .createHmac('sha256', webhook.secret)
                        .update(body)
                        .digest('hex');
                    headers['X-Docker-Dashboard-Signature'] = `sha256=${signature}`;
                }

                const response = await fetch(webhook.url, {
                    method: 'POST',
                    headers,
                    body,
                    signal: AbortSignal.timeout(10_000), // 10s timeout
                });

                if (!response.ok) {
                    console.error(`[Webhooks] Delivery failed to ${webhook.url}: ${response.status}`);
                } else {
                    console.log(`[Webhooks] Delivered to ${webhook.url} (${payload.event})`);
                }
            } catch (err) {
                console.error(`[Webhooks] Delivery error to ${webhook.url}:`, err);
            }
        }
    } catch (err) {
        console.error('[Webhooks] Failed to dispatch webhooks:', err);
    }
}
