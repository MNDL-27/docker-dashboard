import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { deriveHostConnectivity, HOST_ONLINE_THRESHOLD_MS } from '../services/presence';
import { createAgentRateLimiters } from '../middleware/rateLimit';

type HostFixture = {
  id: string;
  organizationId: string;
  projectId: string;
  name: string;
  hostname: string;
  os: string;
  architecture: string;
  dockerVersion: string;
  status: 'ONLINE' | 'OFFLINE';
  lastSeen: Date | null;
};

const fixtures = vi.hoisted(() => ({
  organizationId: 'org-1',
  projectId: 'proj-1',
  userId: 'user-1',
  hostId: 'host-online',
  hosts: [] as HostFixture[],
}));

const prismaMock = vi.hoisted(() => ({
  host: {
    findMany: vi.fn(async () =>
      fixtures.hosts.map((host) => ({
        ...host,
        project: { id: host.projectId, name: 'Project' },
        _count: { containers: 2 },
      }))
    ),
    findFirst: vi.fn(async ({ where }: any) =>
      fixtures.hosts.find(
        (host) =>
          host.id === where.id &&
          host.organizationId === where.organizationId &&
          (!where.projectId || host.projectId === where.projectId)
      ) ?? null
    ),
    update: vi.fn(async ({ where, data }: any) => ({
      id: where.id,
      ...data,
    })),
  },
  container: {
    findMany: vi.fn(async () => []),
  },
}));

vi.mock('../lib/prisma', () => ({ prisma: prismaMock }));

vi.mock('../middleware/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: fixtures.userId };
    next();
  },
}));

vi.mock('../services/scopedAccess', () => ({
  resolveUserScope: vi.fn(async () => ({
    userId: fixtures.userId,
    organizationId: fixtures.organizationId,
    projectId: fixtures.projectId,
    role: 'OPERATOR',
  })),
  resolveAgentScope: vi.fn(async () => true),
  scopedHostWhere: (_scope: any, extra: any = {}) => ({
    organizationId: fixtures.organizationId,
    projectId: fixtures.projectId,
    ...extra,
  }),
  scopedContainerWhere: (_scope: any, extra: any = {}) => extra,
}));

vi.mock('../middleware/agentAuth', () => ({
  AGENT_JWT_ALGORITHMS: ['HS256'],
  AGENT_JWT_AUDIENCE: 'docker-dashboard-agent',
  AGENT_JWT_ISSUER: 'docker-dashboard-cloud',
  requireAgentAuth: (req: any, _res: any, next: any) => {
    req.agent = {
      hostId: fixtures.hostId,
      organizationId: fixtures.organizationId,
      projectId: fixtures.projectId,
    };
    next();
  },
}));

import hostRoutes from '../routes/hosts';
import agentRoutes from '../routes/agent';

describe('presence policy', () => {
  it('derives ONLINE when heartbeat is fresh', () => {
    const now = new Date('2026-03-02T00:00:00.000Z');
    const lastSeen = new Date(now.getTime() - HOST_ONLINE_THRESHOLD_MS + 1_000);
    expect(deriveHostConnectivity(lastSeen, now).status).toBe('ONLINE');
  });

  it('derives OFFLINE when heartbeat exceeds threshold', () => {
    const now = new Date('2026-03-02T00:00:00.000Z');
    const lastSeen = new Date(now.getTime() - HOST_ONLINE_THRESHOLD_MS - 1_000);
    expect(deriveHostConnectivity(lastSeen, now).status).toBe('OFFLINE');
  });
});

describe('host API connectivity payloads', () => {
  const app = express();
  app.use(express.json());
  app.use('/hosts', hostRoutes);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-02T00:00:00.000Z'));
    vi.clearAllMocks();
    fixtures.hosts = [
      {
        id: 'host-online',
        organizationId: fixtures.organizationId,
        projectId: fixtures.projectId,
        name: 'online-host',
        hostname: 'online.local',
        os: 'linux',
        architecture: 'x64',
        dockerVersion: '25.0.0',
        status: 'OFFLINE',
        lastSeen: new Date(Date.now() - 10_000),
      },
      {
        id: 'host-offline',
        organizationId: fixtures.organizationId,
        projectId: fixtures.projectId,
        name: 'offline-host',
        hostname: 'offline.local',
        os: 'linux',
        architecture: 'x64',
        dockerVersion: '25.0.0',
        status: 'ONLINE',
        lastSeen: new Date(Date.now() - HOST_ONLINE_THRESHOLD_MS - 10_000),
      },
    ];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('normalizes list status and includes lastSeen from heartbeat freshness', async () => {
    const res = await request(app)
      .get('/hosts')
      .query({ organizationId: fixtures.organizationId, projectId: fixtures.projectId });

    expect(res.status).toBe(200);
    expect(res.body.hosts).toHaveLength(2);
    expect(res.body.hosts[0]).toMatchObject({ status: 'ONLINE', containerCount: 2 });
    expect(res.body.hosts[1]).toMatchObject({ status: 'OFFLINE', containerCount: 2 });
    expect(res.body.hosts[0].lastSeen).toBeTruthy();
    expect(res.body.hosts[1].lastSeen).toBeTruthy();
  });

  it('normalizes detail status from the same presence service', async () => {
    const res = await request(app)
      .get('/hosts/host-offline')
      .query({ organizationId: fixtures.organizationId, projectId: fixtures.projectId });

    expect(res.status).toBe(200);
    expect(res.body.host).toMatchObject({ id: 'host-offline', status: 'OFFLINE' });
    expect(res.body.host.lastSeen).toBeTruthy();
  });
});

describe('agent heartbeat writes', () => {
  const app = express();
  app.use(express.json());
  app.use('/agent', agentRoutes);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes heartbeat data through shared recordHeartbeat policy', async () => {
    const res = await request(app).post('/agent/heartbeat').send({});
    expect(res.status).toBe(200);

    const updateCall = prismaMock.host.update.mock.calls[0]?.[0];
    expect(updateCall).toBeDefined();
    expect(updateCall.where).toEqual({ id: fixtures.hostId });
    expect(updateCall.data.status).toBe('ONLINE');
    expect(updateCall.data.lastSeen).toBeInstanceOf(Date);
  });
});

describe('host-aware rate limits', () => {
  it('throttles abusive heartbeat traffic by host without blocking healthy hosts', async () => {
    const app = express();
    app.use(express.json());

    const limiters = createAgentRateLimiters({
      windowMs: 60_000,
      heartbeatMax: 2,
    });

    app.use('/agent/heartbeat', (req, _res, next) => {
      const hostId = req.headers['x-host-id'];
      req.agent = {
        hostId: typeof hostId === 'string' ? hostId : 'unknown',
        organizationId: fixtures.organizationId,
        projectId: fixtures.projectId,
      };
      next();
    });
    app.use('/agent/heartbeat', limiters.heartbeat);
    app.post('/agent/heartbeat', (_req, res) => {
      res.status(200).json({ status: 'ok' });
    });

    await request(app).post('/agent/heartbeat').set('x-host-id', 'host-a').send({}).expect(200);
    await request(app).post('/agent/heartbeat').set('x-host-id', 'host-a').send({}).expect(200);
    await request(app).post('/agent/heartbeat').set('x-host-id', 'host-a').send({}).expect(429);

    await request(app).post('/agent/heartbeat').set('x-host-id', 'host-b').send({}).expect(200);
  });

  it('keys enrollment limiter by bootstrap token hash before auth', async () => {
    const app = express();
    app.use(express.json());

    const limiters = createAgentRateLimiters({
      windowMs: 60_000,
      enrollBootstrapMax: 1,
    });

    app.use('/agent/enroll', limiters.enrollBootstrap);
    app.post('/agent/enroll', (_req, res) => {
      res.status(200).json({ status: 'ok' });
    });

    await request(app).post('/agent/enroll').send({ token: 'token-a' }).expect(200);
    await request(app).post('/agent/enroll').send({ token: 'token-a' }).expect(429);
    await request(app).post('/agent/enroll').send({ token: 'token-b' }).expect(200);
  });
});
