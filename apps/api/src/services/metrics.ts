import { prisma } from '../lib/prisma';

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
