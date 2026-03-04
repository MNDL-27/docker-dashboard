import { prisma } from '../lib/prisma';
import { resolveUserScope, scopedContainerWhere } from './scopedAccess';

export const LOG_RETENTION_HOURS = 24;
const LOG_RETENTION_MS = LOG_RETENTION_HOURS * 60 * 60 * 1000;
const LOG_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

export interface LogItem {
    containerId: string;
    stream: string;
    message: string;
    timestamp?: string | number | Date;
}

export interface LogsScope {
    organizationId: string;
    projectId?: string;
    hostId: string;
    containerId: string;
}

export interface LogLine {
    containerId: string;
    stream: string;
    message: string;
    timestamp: string;
}

export interface LogRangeMetadata {
    requestedRange: {
        start: string;
        end: string;
    };
    deliveredRange: {
        start: string | null;
        end: string | null;
    };
    trimmed: {
        start: boolean;
        end: boolean;
        any: boolean;
    };
    retentionCutoff: string;
}

export interface LogRangeResult {
    scope: LogsScope;
    lines: LogLine[];
    metadata: LogRangeMetadata;
}

export interface LiveScopedLogLine extends LogLine {
    hostId: string;
    organizationId: string;
    projectId: string;
}

const DEFAULT_LOG_READ_LIMIT = 500;
const MAX_LOG_READ_LIMIT = 2000;

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

function clampLogReadLimit(limit: number | undefined): number {
    if (!Number.isFinite(limit) || !limit) {
        return DEFAULT_LOG_READ_LIMIT;
    }

    if (limit < 1) {
        return 1;
    }

    if (limit > MAX_LOG_READ_LIMIT) {
        return MAX_LOG_READ_LIMIT;
    }

    return Math.floor(limit);
}

function parseDate(value: string | undefined): Date | undefined {
    if (!value) {
        return undefined;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export async function resolveLogsScopeForUser(input: {
    userId: string;
    organizationId: string;
    projectId?: string;
    hostId: string;
    containerId: string;
}): Promise<LogsScope | null> {
    const scope = await resolveUserScope({
        userId: input.userId,
        organizationId: input.organizationId,
        projectId: input.projectId,
    });

    if (!scope) {
        return null;
    }

    const container = await prisma.container.findFirst({
        where: scopedContainerWhere(scope, {
            id: input.containerId,
            hostId: input.hostId,
        }),
        select: {
            id: true,
        },
    });

    if (!container) {
        return null;
    }

    return {
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        hostId: input.hostId,
        containerId: input.containerId,
    };
}

export async function getLogsRange(input: {
    scope: LogsScope;
    start?: string;
    end?: string;
    limit?: number;
    now?: Date;
}): Promise<LogRangeResult> {
    const now = input.now ?? new Date();
    const retentionCutoff = getLogRetentionCutoff(now);
    const requestedStartInput = parseDate(input.start);
    const requestedEndInput = parseDate(input.end);
    const requestedEnd = requestedEndInput && requestedEndInput < now ? requestedEndInput : now;
    const requestedStart = requestedStartInput ?? clampLogRangeStart(undefined, now);
    const deliveredQueryStart = clampLogRangeStart(requestedStartInput ?? requestedStart, now);
    const limit = clampLogReadLimit(input.limit);

    const fullyOutOfRange = requestedEnd < retentionCutoff;
    if (fullyOutOfRange || requestedEnd < deliveredQueryStart) {
        const trimmedStart = requestedStart < deliveredQueryStart;
        return {
            scope: input.scope,
            lines: [],
            metadata: {
                requestedRange: {
                    start: requestedStart.toISOString(),
                    end: requestedEnd.toISOString(),
                },
                deliveredRange: {
                    start: null,
                    end: null,
                },
                trimmed: {
                    start: trimmedStart,
                    end: false,
                    any: trimmedStart || fullyOutOfRange,
                },
                retentionCutoff: retentionCutoff.toISOString(),
            },
        };
    }

    const logs = await prisma.containerLog.findMany({
        where: {
            containerId: input.scope.containerId,
            timestamp: {
                gte: deliveredQueryStart,
                lte: requestedEnd,
            },
        },
        orderBy: {
            timestamp: 'asc',
        },
        take: limit,
        select: {
            containerId: true,
            stream: true,
            message: true,
            timestamp: true,
        },
    });

    const lines = logs.map((log): LogLine => ({
        containerId: log.containerId,
        stream: log.stream,
        message: log.message,
        timestamp: log.timestamp.toISOString(),
    }));

    return {
        scope: input.scope,
        lines,
        metadata: {
            requestedRange: {
                start: requestedStart.toISOString(),
                end: requestedEnd.toISOString(),
            },
            deliveredRange: {
                start: lines[0]?.timestamp ?? null,
                end: lines.length > 0 ? lines[lines.length - 1].timestamp : null,
            },
            trimmed: {
                start: requestedStart < deliveredQueryStart,
                end: false,
                any: requestedStart < deliveredQueryStart,
            },
            retentionCutoff: retentionCutoff.toISOString(),
        },
    };
}

export async function mapAgentLogsForScopedDelivery(hostId: string, logsArray: LogItem[]): Promise<LiveScopedLogLine[]> {
    if (logsArray.length === 0) {
        return [];
    }

    const dockerIds = [...new Set(logsArray.map((log) => log.containerId))];
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
            hostId: true,
            host: {
                select: {
                    organizationId: true,
                    projectId: true,
                },
            },
        },
    });

    const containerByDockerId = new Map(scopedContainers.map((container) => [container.dockerId, container]));
    const scopedLines: LiveScopedLogLine[] = [];

    for (const log of logsArray) {
        const container = containerByDockerId.get(log.containerId);
        if (!container) {
            continue;
        }

        scopedLines.push({
            containerId: container.id,
            hostId: container.hostId,
            organizationId: container.host.organizationId,
            projectId: container.host.projectId,
            stream: log.stream,
            message: log.message,
            timestamp: coerceLogTimestamp(log.timestamp).toISOString(),
        });
    }

    return scopedLines;
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
