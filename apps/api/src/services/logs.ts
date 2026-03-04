import { prisma } from '../lib/prisma';

export const LOG_RETENTION_HOURS = 24;
const LOG_RETENTION_MS = LOG_RETENTION_HOURS * 60 * 60 * 1000;
const LOG_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

export interface LogItem {
    containerId: string;
    stream: string;
    message: string;
    timestamp?: string | number | Date;
}

export function getLogRetentionCutoff(now: Date = new Date()): Date {
    return new Date(now.getTime() - LOG_RETENTION_MS);
}

export function clampLogRangeStart(requestedStart: Date | undefined, now: Date = new Date()): Date {
    const retentionCutoff = getLogRetentionCutoff(now);
    if (!requestedStart) {
        return retentionCutoff;
    }

    return requestedStart < retentionCutoff ? retentionCutoff : requestedStart;
}

interface BufferedLogItem extends LogItem {
    hostId: string;
}

interface PersistedLogRow {
    containerId: string;
    stream: string;
    message: string;
    timestamp: Date;
}

let logsBuffer: BufferedLogItem[] = [];
let flushTimeout: NodeJS.Timeout | null = null;

export async function saveLogsBatch(hostId: string, logsArray: LogItem[]) {
    if (logsArray.length === 0) {
        return;
    }

    logsBuffer.push(
        ...logsArray.map((log) => ({
            ...log,
            hostId,
        }))
    );

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
        const logsByHost = new Map<string, BufferedLogItem[]>();
        for (const log of batch) {
            const hostLogs = logsByHost.get(log.hostId);
            if (hostLogs) {
                hostLogs.push(log);
            } else {
                logsByHost.set(log.hostId, [log]);
            }
        }

        const rowsToPersist: PersistedLogRow[] = [];

        for (const [hostId, hostLogs] of logsByHost.entries()) {
            const dockerIds = [...new Set(hostLogs.map((log) => log.containerId))];
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

            for (const log of hostLogs) {
                const internalContainerId = internalIdByDockerId.get(log.containerId);
                if (!internalContainerId) {
                    unmatchedCount += 1;
                    continue;
                }

                rowsToPersist.push({
                    containerId: internalContainerId,
                    stream: log.stream,
                    message: log.message,
                    timestamp: coerceLogTimestamp(log.timestamp),
                });
            }

            if (unmatchedCount > 0) {
                console.warn('[logs.ingest.unmatched]', {
                    hostId,
                    unmatchedCount,
                    totalReceived: hostLogs.length,
                });
            }
        }

        if (rowsToPersist.length === 0) {
            return;
        }

        await prisma.containerLog.createMany({
            data: rowsToPersist.map((logRow) => ({
                containerId: logRow.containerId,
                stream: logRow.stream,
                message: logRow.message,
                timestamp: logRow.timestamp,
            })),
            skipDuplicates: true,
        });
    } catch (err) {
        console.error('Failed to flush logs:', err);
    }
}

function coerceLogTimestamp(rawTimestamp: string | number | Date | undefined): Date {
    if (!rawTimestamp) {
        return new Date();
    }

    const parsedTimestamp = new Date(rawTimestamp);
    return Number.isNaN(parsedTimestamp.getTime()) ? new Date() : parsedTimestamp;
}

// Cleanup job: run periodically to delete logs older than 7 days
// Standard metrics might be 24h, logs maybe slightly longer for audit
export async function cleanupOldLogs() {
    try {
        const cutoff = getLogRetentionCutoff();
        const result = await prisma.containerLog.deleteMany({
            where: {
                timestamp: {
                    lt: cutoff,
                },
            },
        });
        console.log(`Cleaned up ${result.count} old log lines.`);
    } catch (err) {
        console.error('Failed to cleanup old logs:', err);
    }
}

// Start cleanup interval (runs hourly)
setInterval(cleanupOldLogs, LOG_CLEANUP_INTERVAL_MS);
