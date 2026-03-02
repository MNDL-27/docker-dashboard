import type { HostStatus } from '@prisma/client';

const DEFAULT_HOST_ONLINE_THRESHOLD_MS = 60_000;

function resolveOnlineThresholdMs(): number {
  const rawValue = process.env.HOST_ONLINE_THRESHOLD_MS;
  if (!rawValue) {
    return DEFAULT_HOST_ONLINE_THRESHOLD_MS;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_HOST_ONLINE_THRESHOLD_MS;
  }

  return parsed;
}

export const HOST_ONLINE_THRESHOLD_MS = resolveOnlineThresholdMs();

export function deriveHostConnectivity(
  lastSeen: Date | null,
  now: Date = new Date(),
): { status: HostStatus; lastSeen: Date | null } {
  if (!lastSeen) {
    return {
      status: 'OFFLINE',
      lastSeen: null,
    };
  }

  const isFresh = now.getTime() - lastSeen.getTime() <= HOST_ONLINE_THRESHOLD_MS;
  return {
    status: isFresh ? 'ONLINE' : 'OFFLINE',
    lastSeen,
  };
}

export function recordHeartbeat(heartbeatAt: Date = new Date()): {
  lastSeen: Date;
  status: HostStatus;
} {
  return {
    lastSeen: heartbeatAt,
    status: deriveHostConnectivity(heartbeatAt, heartbeatAt).status,
  };
}
