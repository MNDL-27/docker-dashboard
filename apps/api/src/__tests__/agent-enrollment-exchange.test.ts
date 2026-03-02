import express from 'express';
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

});
