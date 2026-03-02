import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fixtures = vi.hoisted(() => ({
  memberships: [
    { userId: 'user-1', organizationId: 'org-a', role: 'ADMIN' },
    { userId: 'user-2', organizationId: 'org-b', role: 'ADMIN' },
  ],
  projects: [
    { id: 'proj-a', organizationId: 'org-a' },
    { id: 'proj-b', organizationId: 'org-b' },
  ],
  hosts: [{ id: 'host-a', organizationId: 'org-a', projectId: 'proj-a' }],
}));

const prismaMock = vi.hoisted(() => ({
  organizationMember: {
    findUnique: vi.fn(async ({ where }: any) => {
      const key = where?.userId_organizationId;
      return (
        fixtures.memberships.find(
          (member) => member.userId === key?.userId && member.organizationId === key?.organizationId
        ) ?? null
      );
    }),
  },
  project: {
    findFirst: vi.fn(async ({ where }: any) => {
      return (
        fixtures.projects.find(
          (project) => project.id === where?.id && project.organizationId === where?.organizationId
        ) ?? null
      );
    }),
  },
  host: {
    findMany: vi.fn(async () => []),
    findFirst: vi.fn(async ({ where }: any) => {
      return (
        fixtures.hosts.find(
          (host) =>
            host.id === where?.id &&
            host.organizationId === where?.organizationId &&
            (!where?.projectId || host.projectId === where?.projectId)
        ) ?? null
      );
    }),
    findUnique: vi.fn(async ({ where }: any) => {
      return fixtures.hosts.find((host) => host.id === where?.id) ?? null;
    }),
    update: vi.fn(async () => ({ id: 'host-a' })),
  },
  container: {
    findFirst: vi.fn(async () => null),
    findMany: vi.fn(async () => []),
  },
  auditLog: {
    findMany: vi.fn(async () => []),
    create: vi.fn(async () => ({})),
  },
  alert: {
    findMany: vi.fn(async () => []),
  },
  alertRule: {
    findMany: vi.fn(async () => []),
    findFirst: vi.fn(async () => null),
    create: vi.fn(async () => ({})),
    update: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({})),
  },
  webhook: {
    findMany: vi.fn(async () => []),
    findFirst: vi.fn(async () => null),
    create: vi.fn(async () => ({})),
    update: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({})),
  },
}));

vi.mock('../lib/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('../middleware/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.session = { userId: 'user-1' };
    req.user = { id: 'user-1', email: 'user-1@example.com', name: 'User 1' };
    next();
  },
}));

vi.mock('../middleware/agentAuth', () => ({
  requireAgentAuth: (req: any, _res: any, next: any) => {
    req.agent = {
      hostId: 'host-a',
      organizationId: (req.headers['x-organization-id'] as string) ?? 'org-a',
      projectId: (req.headers['x-project-id'] as string) ?? 'proj-a',
    };
    next();
  },
}));

import hostRoutes from '../routes/hosts';
import actionRoutes from '../routes/actions';
import auditRoutes from '../routes/audit';
import alertRoutes from '../routes/alerts';
import webhookRoutes from '../routes/webhooks';
import agentRoutes from '../routes/agent';
import { authenticateAgentWS } from '../websocket/auth';

const app = express();
app.use(express.json());
app.use('/hosts', hostRoutes);
app.use('/api/containers', actionRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/agent', agentRoutes);

describe('tenant isolation regression coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fixtures.hosts = [{ id: 'host-a', organizationId: 'org-a', projectId: 'proj-a' }];
  });

  it('denies cross-tenant access across hosts/actions/audit/alerts/webhooks', async () => {
    const hostsRes = await request(app).get('/hosts').query({ organizationId: 'org-b' });
    expect(hostsRes.status).toBe(403);

    const actionsRes = await request(app)
      .post('/api/containers/container-a/actions')
      .set('x-organization-id', 'org-b')
      .send({ action: 'START' });
    expect(actionsRes.status).toBe(403);

    const auditRes = await request(app).get('/api/audit').set('x-organization-id', 'org-b');
    expect(auditRes.status).toBe(403);

    const alertsRes = await request(app).get('/api/alerts').set('x-organization-id', 'org-b');
    expect(alertsRes.status).toBe(403);

    const webhookRes = await request(app)
      .get('/api/webhooks')
      .set('x-organization-id', 'org-a')
      .query({ projectId: 'proj-b' });
    expect(webhookRes.status).toBe(403);
  });

  it('keeps in-tenant controls green for scoped reads', async () => {
    const hostsRes = await request(app).get('/hosts').query({ organizationId: 'org-a' });
    expect(hostsRes.status).toBe(200);

    const alertsRes = await request(app).get('/api/alerts').set('x-organization-id', 'org-a');
    expect(alertsRes.status).toBe(200);

    const webhookRes = await request(app).get('/api/webhooks').set('x-organization-id', 'org-a');
    expect(webhookRes.status).toBe(200);
  });

  it('denies out-of-scope ingest and websocket authentication', async () => {
    const heartbeatRes = await request(app)
      .post('/agent/heartbeat')
      .set('x-organization-id', 'org-a')
      .set('x-project-id', 'proj-b')
      .send({});
    expect(heartbeatRes.status).toBe(403);

    const secret = process.env.AGENT_JWT_SECRET || process.env.SESSION_SECRET || 'fallback_agent_secret';
    const invalidScopeToken = jwt.sign(
      { hostId: 'host-a', organizationId: 'org-a', projectId: 'proj-b' },
      secret
    );

    const authenticatedHost = await authenticateAgentWS({
      url: `/ws/agent?token=${invalidScopeToken}`,
      headers: {},
    } as any);

    expect(authenticatedHost).toBeNull();
  });

  it('accepts in-scope websocket authentication', async () => {
    const secret = process.env.AGENT_JWT_SECRET || process.env.SESSION_SECRET || 'fallback_agent_secret';
    const validToken = jwt.sign(
      { hostId: 'host-a', organizationId: 'org-a', projectId: 'proj-a' },
      secret
    );

    const authenticatedHost = await authenticateAgentWS({
      url: `/ws/agent?token=${validToken}`,
      headers: {},
    } as any);

    expect(authenticatedHost).toBe('host-a');
  });
});
