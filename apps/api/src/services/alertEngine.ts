import { prisma } from '../lib/prisma';
import crypto from 'crypto';

const EVAL_INTERVAL_MS = 60_000; // Run every 1 minute

let intervalHandle: NodeJS.Timeout | null = null;

/**
 * Start the alert evaluation loop.
 * Called once from the main app on server boot.
 */
export function startAlertEngine(): void {
    console.log('[AlertEngine] Starting evaluation loop (interval: 60s)');
    // Run immediately on startup, then every EVAL_INTERVAL_MS
    evaluateRules().catch(err => console.error('[AlertEngine] Initial evaluation error:', err));
    intervalHandle = setInterval(() => {
        evaluateRules().catch(err => console.error('[AlertEngine] Evaluation error:', err));
    }, EVAL_INTERVAL_MS);
}

/**
 * Stop the alert evaluation loop (for graceful shutdown).
 */
export function stopAlertEngine(): void {
    if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
        console.log('[AlertEngine] Stopped evaluation loop');
    }
}

/**
 * Core evaluation logic — checks all rules across all orgs.
 */
async function evaluateRules(): Promise<void> {
    const rules = await prisma.alertRule.findMany({
        include: {
            organization: {
                select: { id: true },
            },
        },
    });

    if (rules.length === 0) return;

    for (const rule of rules) {
        try {
            await evaluateRule(rule);
        } catch (err) {
            console.error(`[AlertEngine] Error evaluating rule ${rule.id} (${rule.name}):`, err);
        }
    }
}

/**
 * Evaluate a single rule against all relevant containers.
 */
async function evaluateRule(rule: {
    id: string;
    organizationId: string;
    condition: string;
    threshold: number | null;
    duration: number;
    name: string;
}): Promise<void> {
    // Get all containers belonging to this org's hosts
    const containers = await prisma.container.findMany({
        where: {
            host: {
                organizationId: rule.organizationId,
            },
        },
        include: {
            host: {
                select: { name: true, id: true },
            },
        },
    });

    for (const container of containers) {
        const isConditionMet = await checkCondition(rule, container);

        // Find existing FIRING alert for this rule + container
        const existingAlert = await prisma.alert.findFirst({
            where: {
                ruleId: rule.id,
                containerId: container.id,
                status: 'FIRING',
            },
        });

        if (isConditionMet && !existingAlert) {
            // Fire new alert
            const alert = await prisma.alert.create({
                data: {
                    ruleId: rule.id,
                    containerId: container.id,
                    status: 'FIRING',
                },
            });
            console.log(`[AlertEngine] FIRING alert for rule "${rule.name}" on container "${container.name}"`);
            await dispatchWebhook(alert.id, rule, container, 'alert.firing');
        } else if (!isConditionMet && existingAlert) {
            // Resolve existing alert
            await prisma.alert.update({
                where: { id: existingAlert.id },
                data: {
                    status: 'RESOLVED',
                    resolvedAt: new Date(),
                },
            });
            console.log(`[AlertEngine] RESOLVED alert for rule "${rule.name}" on container "${container.name}"`);
            await dispatchWebhook(existingAlert.id, rule, container, 'alert.resolved');
        }
    }
}

/**
 * Check whether a condition is currently met for a given container.
 */
async function checkCondition(
    rule: { condition: string; threshold: number | null; duration: number },
    container: { id: string; state: string; status: string; updatedAt: Date; host: { name: string } }
): Promise<boolean> {
    const now = new Date();
    const durationMs = rule.duration * 60_000;

    switch (rule.condition) {
        case 'CONTAINER_DOWN': {
            // Container state is "exited" and has been for longer than duration
            if (container.state !== 'exited') return false;
            const downSince = new Date(container.updatedAt).getTime();
            return (now.getTime() - downSince) > durationMs;
        }

        case 'RESTART_LOOP': {
            // Check if container status string indicates restarts (Docker reports "Restarting (N)")
            // Also check recent metrics for frequent state changes
            const threshold = rule.threshold ?? 3; // Default: 3 restarts
            const restartsMatch = container.status.match(/Restarting/i);
            if (restartsMatch) return true;

            // Count recent alerts or status changes as a proxy
            // A more sophisticated implementation would track restart counts on the agent side
            const recentMetrics = await prisma.containerMetric.count({
                where: {
                    containerId: container.id,
                    timestamp: {
                        gte: new Date(now.getTime() - durationMs),
                    },
                },
            });

            // If we have metrics flowing, container is likely restarting frequently
            // This is a simplified heuristic — production would use agent restart event tracking
            return recentMetrics === 0 && container.state === 'restarting';
        }

        case 'CPU_USAGE': {
            if (rule.threshold === null) return false;
            // Get latest metric within the duration window
            const latestMetric = await prisma.containerMetric.findFirst({
                where: {
                    containerId: container.id,
                    timestamp: {
                        gte: new Date(now.getTime() - durationMs),
                    },
                },
                orderBy: { timestamp: 'desc' },
            });

            if (!latestMetric) return false;
            return latestMetric.cpuUsagePercent > rule.threshold;
        }

        case 'MEMORY_USAGE': {
            if (rule.threshold === null) return false;
            // Threshold is in bytes
            const latestMetric = await prisma.containerMetric.findFirst({
                where: {
                    containerId: container.id,
                    timestamp: {
                        gte: new Date(now.getTime() - durationMs),
                    },
                },
                orderBy: { timestamp: 'desc' },
            });

            if (!latestMetric) return false;
            return Number(latestMetric.memoryUsageBytes) > rule.threshold;
        }

        default:
            return false;
    }
}

/**
 * Dispatch webhook notifications for an alert event.
 */
async function dispatchWebhook(
    alertId: string,
    rule: { name: string; organizationId: string },
    container: { name: string; host: { name: string } },
    eventType: 'alert.firing' | 'alert.resolved'
): Promise<void> {
    try {
        const webhooks = await prisma.webhook.findMany({
            where: {
                organizationId: rule.organizationId,
                isActive: true,
            },
        });

        if (webhooks.length === 0) return;

        const payload = JSON.stringify({
            event: eventType,
            alert_id: alertId,
            rule_name: rule.name,
            container_name: container.name,
            host_name: container.host.name,
            timestamp: new Date().toISOString(),
        });

        for (const webhook of webhooks) {
            try {
                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                };

                // HMAC signature if secret is configured
                if (webhook.secret) {
                    const signature = crypto
                        .createHmac('sha256', webhook.secret)
                        .update(payload)
                        .digest('hex');
                    headers['X-Docker-Dashboard-Signature'] = `sha256=${signature}`;
                }

                const response = await fetch(webhook.url, {
                    method: 'POST',
                    headers,
                    body: payload,
                    signal: AbortSignal.timeout(10_000), // 10s timeout
                });

                if (!response.ok) {
                    console.error(`[AlertEngine] Webhook delivery failed to ${webhook.url}: ${response.status}`);
                } else {
                    console.log(`[AlertEngine] Webhook delivered to ${webhook.url} (${eventType})`);
                }
            } catch (err) {
                console.error(`[AlertEngine] Webhook delivery error to ${webhook.url}:`, err);
            }
        }
    } catch (err) {
        console.error('[AlertEngine] Failed to dispatch webhooks:', err);
    }
}
