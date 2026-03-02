import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { hashEnrollmentToken } from '../services/enrollment';

type HostRecord = {
  id: string;
  organizationId: string;
  projectId: string;
  lastSeen: Date | null;
};

type HostTokenRecord = {
  tokenHash: string;
  organizationId: string;
  projectId: string;
  expiresAt: Date;
  usedAt: Date | null;
};

const fixtures = vi.hoisted(() => ({
  bootstrapToken: 'bootstrap-token',
  organizationId: 'org-1',
  projectId: 'proj-1',
  hostTokens: [] as HostTokenRecord[],
  hosts: [] as HostRecord[],
}));

const prismaMock = vi.hoisted(() => ({
  hostToken: {
    updateMany: vi.fn(async ({ where, data }: any) => {
      const candidate = fixtures.hostTokens.find(
        (token) =>
          token.tokenHash === where.tokenHash &&
          token.usedAt === where.usedAt &&
          token.expiresAt.getTime() > where.expiresAt.gt.getTime()
      );

      if (!candidate) {
        return { count: 0 };
      }

      candidate.usedAt = data.usedAt;
      return { count: 1 };
    }),
    findUnique: vi.fn(async ({ where }: any) => {
      const token = fixtures.hostTokens.find((value) => value.tokenHash === where.tokenHash);
      if (!token) {
        return null;
      }

      return {
        organizationId: token.organizationId,
        projectId: token.projectId,
      };
    }),
  },
  host: {
    create: vi.fn(async ({ data }: any) => {
      const created = {
        id: `host-${fixtures.hosts.length + 1}`,
        organizationId: data.organizationId,
        projectId: data.projectId,
        lastSeen: data.lastSeen,
      };
      fixtures.hosts.push(created);
      return created;
    }),
    findUnique: vi.fn(async ({ where }: any) =>
      fixtures.hosts.find((host) => host.id === where.id) ?? null
    ),
    findFirst: vi.fn(async ({ where }: any) =>
      fixtures.hosts.find(
        (host) =>
          host.id === where.id &&
          host.organizationId === where.organizationId &&
          host.projectId === where.projectId
      ) ?? null
    ),
    update: vi.fn(async ({ where, data }: any) => {
      const host = fixtures.hosts.find((value) => value.id === where.id);
      if (!host) {
        throw new Error('host-not-found');
      }

      host.lastSeen = data.lastSeen ?? host.lastSeen;
      return { id: host.id };
    }),
  },
  $transaction: vi.fn(async (fn: any) => fn(prismaMock)),
}));

vi.mock('../lib/prisma', () => ({
  prisma: prismaMock,
}));

import agentRoutes from '../routes/agent';
import {
  AGENT_JWT_ALGORITHMS,
  AGENT_JWT_AUDIENCE,
  AGENT_JWT_ISSUER,
} from '../middleware/agentAuth';
import { authenticateAgentWS } from '../websocket/auth';

const app = express();
app.use(express.json());
app.use('/agent', agentRoutes);

function seedToken(overrides: Partial<HostTokenRecord> = {}): void {
  fixtures.hostTokens.push({
    tokenHash: hashEnrollmentToken(fixtures.bootstrapToken),
    organizationId: fixtures.organizationId,
    projectId: fixtures.projectId,
    expiresAt: new Date(Date.now() + 10 * 60_000),
    usedAt: null,
    ...overrides,
  });
}

const JWT_SECRET = process.env.AGENT_JWT_SECRET || process.env.SESSION_SECRET || 'fallback_agent_secret';

describe('agent enrollment exchange and durable auth policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fixtures.hostTokens = [];
    fixtures.hosts = [];
  });

  it('consumes enrollment token exactly once under concurrent enrollment attempts', async () => {
    seedToken();

    const payload = {
      token: fixtures.bootstrapToken,
      name: 'host one',
      hostname: 'host-one.local',
      os: 'linux',
      architecture: 'x64',
      dockerVersion: '25.0.0',
    };

    const [firstAttempt, secondAttempt] = await Promise.all([
      request(app).post('/agent/enroll').send(payload),
      request(app).post('/agent/enroll').send(payload),
    ]);

    const statuses = [firstAttempt.status, secondAttempt.status].sort();
    expect(statuses).toEqual([200, 401]);
    expect(fixtures.hosts).toHaveLength(1);
    expect(prismaMock.hostToken.updateMany).toHaveBeenCalledTimes(2);
  });

  it('rejects invalid, expired, and replayed enrollment attempts with deterministic 401 responses', async () => {
    const payload = {
      token: 'invalid-token',
      name: 'host one',
      hostname: 'host-one.local',
      os: 'linux',
      architecture: 'x64',
      dockerVersion: '25.0.0',
    };

    const invalidRes = await request(app).post('/agent/enroll').send(payload);
    expect(invalidRes.status).toBe(401);
    expect(invalidRes.body.error).toBe('Invalid enrollment token');

    seedToken({ expiresAt: new Date(Date.now() - 1_000) });
    const expiredRes = await request(app)
      .post('/agent/enroll')
      .send({ ...payload, token: fixtures.bootstrapToken });
    expect(expiredRes.status).toBe(401);
    expect(expiredRes.body.error).toBe('Invalid enrollment token');

    fixtures.hostTokens = [];
    seedToken();
    const enrolledRes = await request(app)
      .post('/agent/enroll')
      .send({ ...payload, token: fixtures.bootstrapToken });
    expect(enrolledRes.status).toBe(200);

    const replayRes = await request(app)
      .post('/agent/enroll')
      .send({ ...payload, token: fixtures.bootstrapToken });
    expect(replayRes.status).toBe(401);
    expect(replayRes.body.error).toBe('Invalid enrollment token');
  });

  it('enforces matching JWT policy and scope binding for HTTP and websocket auth', async () => {
    seedToken();

    const enrollRes = await request(app).post('/agent/enroll').send({
      token: fixtures.bootstrapToken,
      name: 'host one',
      hostname: 'host-one.local',
      os: 'linux',
      architecture: 'x64',
      dockerVersion: '25.0.0',
    });

    expect(enrollRes.status).toBe(200);
    const { agentToken, hostId } = enrollRes.body as { agentToken: string; hostId: string };

    const heartbeatRes = await request(app)
      .post('/agent/heartbeat')
      .set('authorization', `Bearer ${agentToken}`)
      .send({});
    expect(heartbeatRes.status).toBe(200);

    const mismatchedScopeToken = jwt.sign(
      { hostId, organizationId: fixtures.organizationId, projectId: 'proj-2' },
      JWT_SECRET,
      {
        algorithm: AGENT_JWT_ALGORITHMS[0],
        issuer: AGENT_JWT_ISSUER,
        audience: AGENT_JWT_AUDIENCE,
        expiresIn: '5m',
      }
    );

    const outOfScopeHeartbeatRes = await request(app)
      .post('/agent/heartbeat')
      .set('authorization', `Bearer ${mismatchedScopeToken}`)
      .send({});
    expect(outOfScopeHeartbeatRes.status).toBe(401);

    const wrongAudienceToken = jwt.sign(
      { hostId, organizationId: fixtures.organizationId, projectId: fixtures.projectId },
      JWT_SECRET,
      {
        algorithm: AGENT_JWT_ALGORITHMS[0],
        issuer: AGENT_JWT_ISSUER,
        audience: 'dashboard-ui',
        expiresIn: '5m',
      }
    );

    const wrongAlgorithmToken = jwt.sign(
      { hostId, organizationId: fixtures.organizationId, projectId: fixtures.projectId },
      JWT_SECRET,
      {
        algorithm: 'HS384',
        issuer: AGENT_JWT_ISSUER,
        audience: AGENT_JWT_AUDIENCE,
        expiresIn: '5m',
      }
    );

    const badAudienceHeartbeatRes = await request(app)
      .post('/agent/heartbeat')
      .set('authorization', `Bearer ${wrongAudienceToken}`)
      .send({});
    expect(badAudienceHeartbeatRes.status).toBe(401);

    const wsValidHost = await authenticateAgentWS({
      url: `/ws/agent?token=${agentToken}`,
      headers: {},
    } as any);
    expect(wsValidHost).toBe(hostId);

    const wsWrongAudience = await authenticateAgentWS({
      url: `/ws/agent?token=${wrongAudienceToken}`,
      headers: {},
    } as any);
    expect(wsWrongAudience).toBeNull();

    const wsWrongAlgorithm = await authenticateAgentWS({
      url: `/ws/agent?token=${wrongAlgorithmToken}`,
      headers: {},
    } as any);
    expect(wsWrongAlgorithm).toBeNull();
  });

});
