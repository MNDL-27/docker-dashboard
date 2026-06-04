import { prisma } from '../lib/prisma';
import { dispatchWebhooks } from './webhooks';

const EVAL_INTERVAL_MS = 60_000; // Run every 1 minute

let intervalHandle: NodeJS.Timeout | null = null;

/**
 * Start the alert evaluation loop.
 * Called once from the main app on server boot.
 */
export function startAlertEngine(): void {
    console.log('[AlertEngine] Starting evaluation loop (interval: 60s)');
    // Run immediately on startup, then every EVAL_INTERVAL_MS
    evaluateAllRules().catch(err => console.error('[AlertEngine] Initial evaluation error:', err));
    intervalHandle = setInterval(() => {
        evaluateAllRules().catch(err => console.error('[AlertEngine] Evaluation error:', err));
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
async function evaluateAllRules(): Promise<void> {
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
            // Some rules are container-specific, some can be fleet-wide.
            // For Phase 4, we evaluate the same rule against both individual containers 
            // AND the aggregated fleet metrics where applicable.
            
            await evaluateContainerRules(rule);
            await evaluateFleetRule(rule);
            
        } catch (err) {
            console.error(`[AlertEngine] Error evaluating rule ${rule.id} (${rule.name}):`, err);
        }
    }
}

/**
 * Evaluate a rule against individual containers.
 */
async function evaluateContainerRules(rule: any): Promise<void> {
    // Only these conditions apply to individual containers
    const containerConditions = ['CONTAINER_DOWN', 'RESTART_LOOP', 'CPU_USAGE', 'MEMORY_USAGE'];
    if (!containerConditions.includes(rule.condition)) return;

    // Get all containers belonging to this org/project
    const containers = await prisma.container.findMany({
        where: {
            host: {
                organizationId: rule.organizationId,
                ...(rule.projectId ? { projectId: rule.projectId } : {}),
            },
        },
        include: {
            host: {
                select: { name: true, id: true },
            },
        },
    });

    for (const container of containers) {
        const isConditionMet = await checkContainerCondition(rule, container);

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
            
            await dispatchWebhooks(rule.organizationId, rule.projectId, {
                event: 'alert.firing',
                alert_id: alert.id,
                rule_name: rule.name,
                container_name: container.name,
                host_name: container.host.name,
                details: { condition: rule.condition, threshold: rule.threshold }
            });
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
            
            await dispatchWebhooks(rule.organizationId, rule.projectId, {
                event: 'alert.resolved',
                alert_id: existingAlert.id,
                rule_name: rule.name,
                container_name: container.name,
                host_name: container.host.name,
            });
        }
    }
}

/**
 * Evaluate a rule against Fleet aggregated metrics.
 */
async function evaluateFleetRule(rule: any): Promise<void> {
    // These conditions can apply to fleet-wide aggregates
    const fleetConditions = ['CPU_USAGE', 'MEMORY_USAGE'];
    if (!fleetConditions.includes(rule.condition)) return;

    // Get the latest FleetMetric for this org/project
    const latestMetric = await prisma.fleetMetric.findFirst({
        where: {
            organizationId: rule.organizationId,
            projectId: rule.projectId || null,
        },
        orderBy: { timestamp: 'desc' },
    });

    if (!latestMetric) return;

    // Check if the metric is recent enough (e.g. within last 5 minutes)
    const now = new Date();
    if (now.getTime() - new Date(latestMetric.timestamp).getTime() > 5 * 60_000) {
        return;
    }

    let isConditionMet = false;
    const threshold = rule.threshold;
    if (threshold === null) return;

    if (rule.condition === 'CPU_USAGE') {
        isConditionMet = latestMetric.cpuUsagePercentAvg > threshold;
    } else if (rule.condition === 'MEMORY_USAGE') {
        isConditionMet = Number(latestMetric.memoryUsageBytesAvg) > threshold;
    }

    // Find existing FIRING incident for this rule (no containerId means fleet-wide)
    const existingIncident = await prisma.incident.findFirst({
        where: {
            ruleId: rule.id,
            organizationId: rule.organizationId,
            projectId: rule.projectId || null,
            status: 'FIRING',
        },
    });

    if (isConditionMet && !existingIncident) {
        // Trigger new Incident
        const incident = await prisma.incident.create({
            data: {
                ruleId: rule.id,
                organizationId: rule.organizationId,
                projectId: rule.projectId || null,
                status: 'FIRING',
            },
        });
        console.log(`[AlertEngine] FIRING incident for rule "${rule.name}" on fleet (${rule.projectId || 'org-wide'})`);
        
        await dispatchWebhooks(rule.organizationId, rule.projectId, {
            event: 'incident.firing',
            incident_id: incident.id,
            rule_name: rule.name,
            details: { 
                scope: rule.projectId ? 'project' : 'organization',
                condition: rule.condition, 
                threshold, 
                current_value: rule.condition === 'CPU_USAGE' ? latestMetric.cpuUsagePercentAvg : latestMetric.memoryUsageBytesAvg.toString() 
            }
        });
    } else if (!isConditionMet && existingIncident) {
        // Resolve existing incident
        await prisma.incident.update({
            where: { id: existingIncident.id },
            data: {
                status: 'RESOLVED',
                resolvedAt: new Date(),
            },
        });
        console.log(`[AlertEngine] RESOLVED incident for rule "${rule.name}" on fleet`);
        
        await dispatchWebhooks(rule.organizationId, rule.projectId, {
            event: 'incident.resolved',
            incident_id: existingIncident.id,
            rule_name: rule.name,
        });
    }
}

/**
 * Check whether a condition is currently met for a given container.
 */
async function checkContainerCondition(
    rule: { condition: string; threshold: number | null; duration: number },
    container: { id: string; state: string; status: string; updatedAt: Date; host: { name: string } }
): Promise<boolean> {
    const now = new Date();
    const durationMs = rule.duration * 60_000;

    switch (rule.condition) {
        case 'CONTAINER_DOWN': {
            if (container.state !== 'exited') return false;
            const downSince = new Date(container.updatedAt).getTime();
            return (now.getTime() - downSince) > durationMs;
        }

        case 'RESTART_LOOP': {
            const threshold = rule.threshold ?? 3;
            const restartsMatch = container.status.match(/Restarting/i);
            if (restartsMatch) return true;

            const recentMetrics = await prisma.containerMetric.count({
                where: {
                    containerId: container.id,
                    timestamp: {
                        gte: new Date(now.getTime() - durationMs),
                    },
                },
            });

            return recentMetrics === 0 && container.state === 'restarting';
        }

        case 'CPU_USAGE': {
            if (rule.threshold === null) return false;
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
