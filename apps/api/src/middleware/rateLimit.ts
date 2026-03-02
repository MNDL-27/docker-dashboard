import { createHash } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import rateLimit, { type Store } from 'express-rate-limit';
import { Redis } from 'ioredis';
import { RedisStore } from 'rate-limit-redis';

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_ENROLL_BOOTSTRAP_LIMIT = 10;
const DEFAULT_HEARTBEAT_LIMIT = 180;
const DEFAULT_CONTAINER_INGEST_LIMIT = 60;

function parsePositiveInteger(rawValue: string | undefined, fallback: number): number {
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function stableHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 20);
}

function requestIp(request: Request): string {
  return request.ip || request.socket.remoteAddress || 'unknown';
}

function resolveRedisStore(): Store | undefined {
  const redisUrl = process.env.RATE_LIMIT_REDIS_URL;
  if (!redisUrl) {
    return undefined;
  }

  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });

  redis.on('error', (error) => {
    console.error('Rate limit Redis error:', error.message);
  });

  return new RedisStore({
    sendCommand: (...args: string[]) => {
      const [command, ...commandArgs] = args;
      return redis.call(command, ...commandArgs) as Promise<any>;
    },
  });
}

function buildLimiter(options: {
  max: number;
  windowMs: number;
  keyGenerator: (request: Request) => string;
  message: string;
  store?: Store;
}): RequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    keyGenerator: options.keyGenerator,
    standardHeaders: true,
    legacyHeaders: false,
    passOnStoreError: true,
    store: options.store,
    message: { error: options.message },
  });
}

export interface AgentRateLimiters {
  enrollBootstrap: RequestHandler;
  heartbeat: RequestHandler;
  containerIngest: RequestHandler;
}

export interface AgentRateLimiterConfig {
  windowMs?: number;
  enrollBootstrapMax?: number;
  heartbeatMax?: number;
  containerIngestMax?: number;
  store?: Store;
}

export function createAgentRateLimiters(config: AgentRateLimiterConfig = {}): AgentRateLimiters {
  const store = config.store ?? resolveRedisStore();
  const windowMs = config.windowMs ?? parsePositiveInteger(process.env.AGENT_RATE_LIMIT_WINDOW_MS, DEFAULT_WINDOW_MS);
  const enrollBootstrapMax = config.enrollBootstrapMax ??
    parsePositiveInteger(process.env.AGENT_ENROLL_BOOTSTRAP_RATE_LIMIT_MAX, DEFAULT_ENROLL_BOOTSTRAP_LIMIT);
  const heartbeatMax = config.heartbeatMax ??
    parsePositiveInteger(process.env.AGENT_HEARTBEAT_RATE_LIMIT_MAX, DEFAULT_HEARTBEAT_LIMIT);
  const containerIngestMax = config.containerIngestMax ??
    parsePositiveInteger(process.env.AGENT_CONTAINER_INGEST_RATE_LIMIT_MAX, DEFAULT_CONTAINER_INGEST_LIMIT);

  const enrollBootstrap = buildLimiter({
    max: enrollBootstrapMax,
    windowMs,
    store,
    message: 'Enrollment rate limit exceeded',
    keyGenerator: (request) => {
      const token = request.body && typeof request.body.token === 'string' ? request.body.token.trim() : '';
      if (token.length > 0) {
        return `enroll:${stableHash(token)}`;
      }

      return `enroll-ip:${requestIp(request)}`;
    },
  });

  const heartbeat = buildLimiter({
    max: heartbeatMax,
    windowMs,
    store,
    message: 'Heartbeat rate limit exceeded',
    keyGenerator: (request) => {
      const hostId = request.agent?.hostId?.trim();
      if (hostId) {
        return `heartbeat:${hostId}`;
      }

      return `heartbeat-ip:${requestIp(request)}`;
    },
  });

  const containerIngest = buildLimiter({
    max: containerIngestMax,
    windowMs,
    store,
    message: 'Container ingest rate limit exceeded',
    keyGenerator: (request) => {
      const hostId = request.agent?.hostId?.trim();
      if (hostId) {
        return `containers:${hostId}`;
      }

      return `containers-ip:${requestIp(request)}`;
    },
  });

  return {
    enrollBootstrap,
    heartbeat,
    containerIngest,
  };
}
