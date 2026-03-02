import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { hashEnrollmentToken } from '../services/enrollment';

const fixtures = vi.hoisted(() => ({
  membershipRole: 'OPERATOR',
  userId: 'user-1',
  organizationId: 'org-1',
  projectId: 'proj-1',
  projectName: 'Primary Project',
}));

const prismaMock = vi.hoisted(() => ({
  organizationMember: {
    findUnique: vi.fn(async ({ where }: any) => {
      const key = where?.userId_organizationId;
      if (key?.userId !== fixtures.userId || key?.organizationId !== fixtures.organizationId) {
        return null;
      }

      return { role: fixtures.membershipRole };
    }),
  },
  host: {
    findMany: vi.fn(async () => []),
    findFirst: vi.fn(async () => null),
  },
  container: {
    findMany: vi.fn(async () => []),
  },
  hostToken: {
    create: vi.fn(async ({ data }: any) => ({
      id: 'token-1',
      expiresAt: data.expiresAt,
    })),
  },
  project: {
    findFirst: vi.fn(async ({ where }: any) => {
      if (where?.id !== fixtures.projectId || where?.organizationId !== fixtures.organizationId) {
        return null;
      }

      return {
        id: fixtures.projectId,
        name: fixtures.projectName,
      };
    }),
  },
  $transaction: vi.fn(async (fn: any) => fn(prismaMock)),
}));

vi.mock('../lib/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('../middleware/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.session = { userId: fixtures.userId };
    req.user = { id: fixtures.userId, email: 'user-1@example.com' };
    next();
  },
}));

vi.mock('../config/transport', () => ({
  getPublicApiUrl: () => 'https://cloud.example.test',
}));

import hostRoutes from '../routes/hosts';

const app = express();
app.use(express.json());
app.use('/hosts', hostRoutes);

describe('POST /hosts/tokens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fixtures.membershipRole = 'OPERATOR';
  });

  it('returns plaintext token once and persists only hash metadata', async () => {
    const res = await request(app).post('/hosts/tokens').send({
      organizationId: fixtures.organizationId,
      projectId: fixtures.projectId,
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(res.body.cloudUrl).toBe('https://cloud.example.test');
    expect(res.body.command).toContain('AGENT_API_URL="https://cloud.example.test"');
    expect(res.body.command).toContain(`AGENT_TOKEN="${res.body.token}"`);

    const createCall = prismaMock.hostToken.create.mock.calls[0]?.[0];
    expect(createCall).toBeDefined();
    expect(createCall.data).toMatchObject({
      organizationId: fixtures.organizationId,
      projectId: fixtures.projectId,
      createdBy: fixtures.userId,
    });
    expect(createCall.data).not.toHaveProperty('token');
    expect(createCall.data.tokenHash).toBe(hashEnrollmentToken(res.body.token));

    const expiresAt = Date.parse(res.body.expiresAt);
    expect(Number.isNaN(expiresAt)).toBe(false);
    expect(expiresAt).toBeGreaterThan(Date.now());
  });

  it('rejects viewers from issuing enrollment tokens', async () => {
    fixtures.membershipRole = 'VIEWER';

    const res = await request(app).post('/hosts/tokens').send({
      organizationId: fixtures.organizationId,
      projectId: fixtures.projectId,
    });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Insufficient permissions');
    expect(prismaMock.hostToken.create).not.toHaveBeenCalled();
  });
});
