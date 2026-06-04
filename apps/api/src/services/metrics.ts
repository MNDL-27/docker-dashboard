import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';

export const METRICS_RETENTION_HOURS = 24;
const METRICS_RETENTION_MS = METRICS_RETENTION_HOURS * 60 * 60 * 1000;
const METRICS_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

export interface MetricItem {
    containerId: string;
    cpuUsagePercent: number;
    memoryUsageBytes: number;
    networkRxBytes: number;
    networkTxBytes: number;
}

export function getMetricsRetentionCutoff(now: Date = new Date()): Date {
    return new Date(now.getTime() - METRICS_RETENTION_MS);
}

export function clampMetricsLookbackStart(requestedStart: Date | undefined, now: Date = new Date()): Date {
    const retentionCutoff = getMetricsRetentionCutoff(now);
    if (!requestedStart) {
        return retentionCutoff;
    }

    return requestedStart < retentionCutoff ? retentionCutoff : requestedStart;
}

interface BufferedMetricItem extends MetricItem {
    hostId: string;
}

// In-memory buffer for batched inserts
let metricsBuffer: BufferedMetricItem[] = [];
let flushTimeout: NodeJS.Timeout | null = null;

export async function saveMetricsBatch(hostId: string, metricsArray: MetricItem[]) {
    if (metricsArray.length === 0) {
        return;
    }

    metricsBuffer.push(
        ...metricsArray.map((metric) => ({
            ...metric,
            hostId,
        }))
    );

    if (!flushTimeout) {
        flushTimeout = setTimeout(flushMetrics, 2000); // Flush every 2 seconds
    }
}

async function flushMetrics() {
    if (metricsBuffer.length === 0) return;

    const batch = [...metricsBuffer];
    metricsBuffer = [];
    flushTimeout = null;

    try {
        const metricsByHost = new Map<string, BufferedMetricItem[]>();
        for (const metric of batch) {
            const hostMetrics = metricsByHost.get(metric.hostId);
            if (hostMetrics) {
                hostMetrics.push(metric);
            } else {
                metricsByHost.set(metric.hostId, [metric]);
            }
        }

        const rowsToPersist: MetricItem[] = [];

        for (const [hostId, hostMetrics] of metricsByHost.entries()) {
            const dockerIds = [...new Set(hostMetrics.map((metric) => metric.containerId))];
            const scopedContainers = await prisma.container.findMany({
                where: {
                    hostId,
                    dockerId: {
                        in: dockerIds,
                    },
                },
                select: {
                    id: true,
                    dockerId: true,
                },
            });

            const internalIdByDockerId = new Map(scopedContainers.map((container) => [container.dockerId, container.id]));
            let unmatchedCount = 0;

            for (const metric of hostMetrics) {
                const internalContainerId = internalIdByDockerId.get(metric.containerId);
                if (!internalContainerId) {
                    unmatchedCount += 1;
                    continue;
                }

                rowsToPersist.push({
                    containerId: internalContainerId,
                    cpuUsagePercent: metric.cpuUsagePercent,
                    memoryUsageBytes: metric.memoryUsageBytes,
                    networkRxBytes: metric.networkRxBytes,
                    networkTxBytes: metric.networkTxBytes,
                });
            }

            if (unmatchedCount > 0) {
                console.warn('[metrics.ingest.unmatched]', {
                    hostId,
                    unmatchedCount,
                    totalReceived: hostMetrics.length,
                });
            }
        }

        if (rowsToPersist.length === 0) {
            return;
        }

        await prisma.containerMetric.createMany({
            data: rowsToPersist.map((m) => ({
                containerId: m.containerId,
                cpuUsagePercent: m.cpuUsagePercent,
                memoryUsageBytes: BigInt(m.memoryUsageBytes),
                networkRxBytes: BigInt(m.networkRxBytes),
                networkTxBytes: BigInt(m.networkTxBytes),
            })),
            skipDuplicates: true,
        });
    } catch (err) {
        console.error('Failed to flush metrics:', err);
    }
}

// Cleanup job: run periodically to delete metrics older than 24 hours
export async function cleanupOldMetrics() {
    try {
        const cutoff = getMetricsRetentionCutoff();
        const result = await prisma.containerMetric.deleteMany({
            where: {
                timestamp: {
                    lt: cutoff,
                },
            },
        });
        console.log(`Cleaned up ${result.count} old metrics.`);
    } catch (err) {
        console.error('Failed to cleanup old metrics:', err);
    }
}

// Start cleanup interval (runs hourly)
setInterval(cleanupOldMetrics, METRICS_CLEANUP_INTERVAL_MS);

/**
 * Periodically aggregates live metrics for each Organization and Project
 * and persists them to the FleetMetric table for historical trend analysis.
 */
export async function runFleetMetricsAggregation() {
    try {
        const now = new Date();
        const recentCutoff = new Date(now.getTime() - 5 * 60 * 1000);

        // Get latest metrics for all containers seen in the last 5 minutes
        const aggregates = await prisma.$queryRaw<Array<{
            organizationId: string;
            projectId: string;
            containerCount: bigint;
            cpuUsagePercentAvg: number;
            memoryUsageBytesAvg: number;
            networkRxBytesMax: bigint;
            networkTxBytesMax: bigint;
        }>>`
            WITH LatestMetrics AS (
                SELECT DISTINCT ON ("containerId")
                    "containerId",
                    "cpuUsagePercent",
                    "memoryUsageBytes",
                    "networkRxBytes",
                    "networkTxBytes",
                    "timestamp"
                FROM "ContainerMetric"
                WHERE "timestamp" >= ${recentCutoff}
                ORDER BY "containerId", "timestamp" DESC
            )
            SELECT
                h."organizationId",
                h."projectId",
                COUNT(lm."containerId") as "containerCount",
                AVG(lm."cpuUsagePercent") as "cpuUsagePercentAvg",
                AVG(lm."memoryUsageBytes") as "memoryUsageBytesAvg",
                MAX(lm."networkRxBytes") as "networkRxBytesMax",
                MAX(lm."networkTxBytes") as "networkTxBytesMax"
            FROM LatestMetrics lm
            JOIN "Container" c ON lm."containerId" = c.id
            JOIN "Host" h ON c."hostId" = h.id
            GROUP BY h."organizationId", h."projectId"
        `;

        if (aggregates.length === 0) {
            return;
        }

        const orgAggregates = new Map<string, {
            containerCount: number;
            cpuUsagePercentTotal: number;
            memoryUsageBytesTotal: bigint;
            networkRxBytesMax: bigint;
            networkTxBytesMax: bigint;
        }>();

        const fleetMetricsToCreate: any[] = [];

        for (const agg of aggregates) {
            const containerCount = Number(agg.containerCount);
            
            // Add Project-level metric
            fleetMetricsToCreate.push({
                organizationId: agg.organizationId,
                projectId: agg.projectId,
                timestamp: now,
                containerCount,
                cpuUsagePercentAvg: Number((agg.cpuUsagePercentAvg || 0).toFixed(2)),
                memoryUsageBytesAvg: BigInt(Math.round(agg.memoryUsageBytesAvg || 0)),
                networkRxBytesMax: agg.networkRxBytesMax || BigInt(0),
                networkTxBytesMax: agg.networkTxBytesMax || BigInt(0),
            });

            // Accumulate for Organization-level
            const existingOrg = orgAggregates.get(agg.organizationId) || {
                containerCount: 0,
                cpuUsagePercentTotal: 0,
                memoryUsageBytesTotal: BigInt(0),
                networkRxBytesMax: BigInt(0),
                networkTxBytesMax: BigInt(0),
            };

            existingOrg.containerCount += containerCount;
            existingOrg.cpuUsagePercentTotal += (agg.cpuUsagePercentAvg || 0) * containerCount;
            existingOrg.memoryUsageBytesTotal += BigInt(Math.round(agg.memoryUsageBytesAvg || 0)) * BigInt(containerCount);
            
            if (agg.networkRxBytesMax && agg.networkRxBytesMax > existingOrg.networkRxBytesMax) {
                existingOrg.networkRxBytesMax = agg.networkRxBytesMax;
            }
            if (agg.networkTxBytesMax && agg.networkTxBytesMax > existingOrg.networkTxBytesMax) {
                existingOrg.networkTxBytesMax = agg.networkTxBytesMax;
            }

            orgAggregates.set(agg.organizationId, existingOrg);
        }

        // Add Organization-level metrics
        for (const [orgId, agg] of orgAggregates.entries()) {
            if (agg.containerCount > 0) {
                fleetMetricsToCreate.push({
                    organizationId: orgId,
                    projectId: null,
                    timestamp: now,
                    containerCount: agg.containerCount,
                    cpuUsagePercentAvg: Number((agg.cpuUsagePercentTotal / agg.containerCount).toFixed(2)),
                    memoryUsageBytesAvg: agg.memoryUsageBytesTotal / BigInt(agg.containerCount),
                    networkRxBytesMax: agg.networkRxBytesMax,
                    networkTxBytesMax: agg.networkTxBytesMax,
                });
            }
        }

        if (fleetMetricsToCreate.length > 0) {
            await prisma.fleetMetric.createMany({
                data: fleetMetricsToCreate,
            });
        }
    } catch (err) {
        console.error('[fleet-metrics.aggregation.error]', err);
    }
}

export async function cleanupOldFleetMetrics() {
    try {
        const cutoff = getMetricsRetentionCutoff();
        const result = await prisma.fleetMetric.deleteMany({
            where: {
                timestamp: {
                    lt: cutoff,
                },
            },
        });
        if (result.count > 0) {
            console.log(`Cleaned up ${result.count} old fleet metrics.`);
        }
    } catch (err) {
        console.error('[fleet-metrics.cleanup.error]', err);
    }
}

// Start Fleet Metrics Aggregation (runs every minute)
setInterval(runFleetMetricsAggregation, 60 * 1000);

// Cleanup Fleet Metrics hourly
setInterval(cleanupOldFleetMetrics, METRICS_CLEANUP_INTERVAL_MS);
