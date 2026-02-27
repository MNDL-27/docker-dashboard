import { prisma } from '../lib/prisma';

export interface MetricItem {
    containerId: string;
    cpuUsagePercent: number;
    memoryUsageBytes: number;
    networkRxBytes: number;
    networkTxBytes: number;
}

// In-memory buffer for batched inserts
let metricsBuffer: MetricItem[] = [];
let flushTimeout: NodeJS.Timeout | null = null;

export async function saveMetricsBatch(hostId: string, metricsArray: MetricItem[]) {
    // We accept hostId to validate or enrich, but metrics have their own containerId.
    metricsBuffer.push(...metricsArray);

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
        await prisma.containerMetric.createMany({
            data: batch.map(m => ({
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
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const result = await prisma.containerMetric.deleteMany({
            where: {
                timestamp: {
                    lt: yesterday,
                },
            },
        });
        console.log(`Cleaned up ${result.count} old metrics.`);
    } catch (err) {
        console.error('Failed to cleanup old metrics:', err);
    }
}

// Start cleanup interval (runs hourly)
setInterval(cleanupOldMetrics, 60 * 60 * 1000);
