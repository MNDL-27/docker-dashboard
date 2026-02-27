import { prisma } from '../lib/prisma';

export interface LogItem {
    containerId: string;
    stream: string;
    message: string;
}

let logsBuffer: LogItem[] = [];
let flushTimeout: NodeJS.Timeout | null = null;

export async function saveLogsBatch(hostId: string, logsArray: LogItem[]) {
    // Add to buffer
    logsBuffer.push(...logsArray);

    // Debounce flush
    if (!flushTimeout) {
        flushTimeout = setTimeout(flushLogs, 2000); // Flush every 2 seconds
    }
}

async function flushLogs() {
    if (logsBuffer.length === 0) return;

    const batch = [...logsBuffer];
    logsBuffer = [];
    flushTimeout = null;

    try {
        await prisma.containerLog.createMany({
            data: batch.map(l => ({
                containerId: l.containerId,
                stream: l.stream,
                message: l.message,
            })),
            skipDuplicates: true,
        });
    } catch (err) {
        console.error('Failed to flush logs:', err);
    }
}

// Cleanup job: run periodically to delete logs older than 7 days
// Standard metrics might be 24h, logs maybe slightly longer for audit
export async function cleanupOldLogs() {
    try {
        const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const result = await prisma.containerLog.deleteMany({
            where: {
                timestamp: {
                    lt: lastWeek,
                },
            },
        });
        console.log(`Cleaned up ${result.count} old log lines.`);
    } catch (err) {
        console.error('Failed to cleanup old logs:', err);
    }
}

// Start cleanup interval (runs hourly)
setInterval(cleanupOldLogs, 60 * 60 * 1000);
