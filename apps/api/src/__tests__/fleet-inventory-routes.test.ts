import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type FixtureHost = {
  id: string;
  organizationId: string;
  projectId: string;
  name: string;
  hostname: string;
  ipAddress: string | null;
  agentVersion: string | null;
  cpuCount: number | null;
  memoryTotalBytes: bigint | null;
  os: string;
  architecture: string;
  dockerVersion: string;
  status: 'ONLINE' | 'OFFLINE';
  lastSeen: Date | null;
};

type FixtureContainer = {
  id: string;
  hostId: string;
  dockerId: string;
  name: string;
  image: string;
  imageId: string;
  command: string;
  state: string;
  status: string;
  restartCount: number;
  ports: Record<string, unknown>;
  labels: Record<string, unknown>;
  networks: Record<string, unknown>;
  volumes: string[];
  dockerCreatedAt: Date | null;
  startedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const fixtures = vi.hoisted(() => ({
  userId: 'user-a',
  memberships: [
    { userId: 'user-a', organizationId: 'org-a', role: 'ADMIN' },
    { userId: 'user-b', organizationId: 'org-b', role: 'ADMIN' },
  ],
  projects: [
    { id: 'proj-a', organizationId: 'org-a', name: 'Project A' },
    { id: 'proj-b', organizationId: 'org-b', name: 'Project B' },
  ],
  hosts: [] as FixtureHost[],
  containers: [] as FixtureContainer[],
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
    findMany: vi.fn(async ({ where }: any) => {
      const ids = new Set(where?.id?.in ?? []);
      return fixtures.projects
        .filter((project) => project.organizationId === where?.organizationId && ids.has(project.id))
        .map((project) => ({ id: project.id }));
    }),
  },
  host: {
    findMany: vi.fn(async ({ where }: any) => {
      const idFilter = where?.id?.in;
      const projectFilter = where?.projectId;
      return fixtures.hosts
        .filter((host) => {
          if (host.organizationId !== where?.organizationId) {
            return false;
          }
          if (projectFilter && host.projectId !== projectFilter) {
            return false;
          }
          if (Array.isArray(idFilter) && !idFilter.includes(host.id)) {
            return false;
          }
          return true;
        })
        .map((host) => ({
          ...host,
          project: { id: host.projectId, name: 'Project A' },
          _count: { containers: fixtures.containers.filter((container) => container.hostId === host.id).length },
        }));
    }),
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
  },
  container: {
    findMany: vi.fn(async ({ where }: any) => {
      const hostScope = where?.host;
      const hostId = where?.hostId;
      const searchFilters = where?.OR;

      return fixtures.containers.filter((container) => {
        const host = fixtures.hosts.find((item) => item.id === container.hostId);
        if (!host) {
          return false;
        }

        if (hostId && container.hostId !== hostId) {
          return false;
        }

        if (hostScope?.organizationId && host.organizationId !== hostScope.organizationId) {
          return false;
        }

        if (hostScope?.projectId && host.projectId !== hostScope.projectId) {
          return false;
        }

        if (Array.isArray(searchFilters) && searchFilters.length > 0) {
          return searchFilters.some((filter) => {
            const nameContains = filter?.name?.contains;
            const imageContains = filter?.image?.contains;
            if (nameContains) {
              return container.name.toLowerCase().includes(String(nameContains).toLowerCase());
            }
            if (imageContains) {
              return container.image.toLowerCase().includes(String(imageContains).toLowerCase());
            }
            return false;
          });
        }

        return true;
      });
    }),
  },
}));

vi.mock('../lib/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('../middleware/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: fixtures.userId };
    next();
  },
}));

import hostRoutes from '../routes/hosts';

describe('fleet inventory route contracts', () => {
  const app = express();
  app.use(express.json());
  app.use('/hosts', hostRoutes);

  beforeEach(() => {
    vi.clearAllMocks();
    fixtures.userId = 'user-a';
    fixtures.hosts = [
      {
        id: 'host-a',
        organizationId: 'org-a',
        projectId: 'proj-a',
        name: 'alpha-host',
        hostname: 'alpha.local',
        ipAddress: '10.0.0.2',
        agentVersion: 'go1.22',
        cpuCount: 8,
        memoryTotalBytes: 16_000_000_000n,
        os: 'linux',
        architecture: 'x64',
        dockerVersion: '25.0.0',
        status: 'ONLINE',
        lastSeen: new Date('2026-03-04T15:00:00.000Z'),
      },
      {
        id: 'host-b',
        organizationId: 'org-a',
        projectId: 'proj-a',
        name: 'beta-host',
        hostname: 'beta.local',
        ipAddress: '10.0.0.3',
        agentVersion: 'go1.22',
        cpuCount: 4,
        memoryTotalBytes: 8_000_000_000n,
        os: 'linux',
        architecture: 'x64',
        dockerVersion: '25.0.0',
        status: 'ONLINE',
        lastSeen: new Date('2026-03-04T15:00:00.000Z'),
      },
    ];

    fixtures.containers = [
      {
        id: 'ctr-1',
        hostId: 'host-a',
        dockerId: 'docker-1',
        name: 'api-service',
        image: 'ghcr.io/acme/api:1.0',
        imageId: 'img-1',
        command: 'node server.js',
        state: 'running',
        status: 'Up 2 hours',
        restartCount: 3,
        ports: { '3000/tcp': 3000 },
        labels: { project: 'fleet', tier: 'backend' },
        networks: { bridge: { ipAddress: '172.18.0.2' } },
        volumes: ['/var/lib/app'],
        dockerCreatedAt: new Date('2026-03-01T10:00:00.000Z'),
        startedAt: new Date('2026-03-04T13:00:00.000Z'),
        createdAt: new Date('2026-03-04T13:00:00.000Z'),
        updatedAt: new Date('2026-03-04T13:00:00.000Z'),
      },
      {
        id: 'ctr-2',
        hostId: 'host-a',
        dockerId: 'docker-2',
        name: 'worker',
        image: 'ghcr.io/acme/worker:2.1',
        imageId: 'img-2',
        command: 'node worker.js',
        state: 'restarting',
        status: 'Restarting (1) 5 seconds ago',
        restartCount: 5,
        ports: {},
        labels: { project: 'fleet', role: 'queue' },
        networks: { bridge: { ipAddress: '172.18.0.3' } },
        volumes: ['/var/lib/worker'],
        dockerCreatedAt: new Date('2026-03-02T10:00:00.000Z'),
        startedAt: new Date('2026-03-04T14:00:00.000Z'),
        createdAt: new Date('2026-03-04T14:00:00.000Z'),
        updatedAt: new Date('2026-03-04T14:00:00.000Z'),
      },
      {
        id: 'ctr-3',
        hostId: 'host-b',
        dockerId: 'docker-3',
        name: 'db',
        image: 'postgres:16',
        imageId: 'img-3',
        command: 'postgres',
        state: 'running',
        status: 'Up 3 hours',
        restartCount: 0,
        ports: { '5432/tcp': 5432 },
        labels: { service: 'database' },
        networks: { bridge: { ipAddress: '172.18.0.4' } },
        volumes: ['/var/lib/postgresql/data'],
        dockerCreatedAt: new Date('2026-03-03T10:00:00.000Z'),
        startedAt: new Date('2026-03-04T12:00:00.000Z'),
        createdAt: new Date('2026-03-04T12:00:00.000Z'),
        updatedAt: new Date('2026-03-04T12:00:00.000Z'),
      },
    ];
  });

  it('returns fleet-level totals and host cards for scoped GET /hosts', async () => {
    const res = await request(app).get('/hosts').query({ organizationId: 'org-a', projectId: 'proj-a' });

    expect(res.status).toBe(200);
    expect(res.body.fleetTotals).toEqual({ hostCount: 2, containerCount: 3 });
    expect(res.body.hosts).toHaveLength(2);
    expect(res.body.hosts[0]).toMatchObject({ id: 'host-a', containerCount: 2 });
    expect(res.body.hosts[1]).toMatchObject({ id: 'host-b', containerCount: 1 });
  });

  it('returns required container payload fields from GET /hosts/:id/containers', async () => {
    const res = await request(app)
      .get('/hosts/host-a/containers')
      .query({ organizationId: 'org-a', projectId: 'proj-a' });

    expect(res.status).toBe(200);
    expect(res.body.containers).toHaveLength(2);
    expect(res.body.containers[0]).toMatchObject({
      name: 'api-service',
      image: 'ghcr.io/acme/api:1.0',
      status: 'Up 2 hours',
      restartCount: 3,
      labels: { project: 'fleet', tier: 'backend' },
    });
  });

  it('supports server-side search over name/image/labels plus status/project/host filters', async () => {
    const res = await request(app)
      .get('/hosts/host-a/containers')
      .query({
        organizationId: 'org-a',
        search: 'queue',
        statuses: 'restarting,running',
        projectIds: 'proj-a',
        hostIds: 'host-a',
      });

    expect(res.status).toBe(200);
    expect(res.body.containers).toHaveLength(1);
    expect(res.body.containers[0]).toMatchObject({ name: 'worker', restartCount: 5, state: 'restarting' });
  });

  it('rejects out-of-scope host filter values', async () => {
    const res = await request(app)
      .get('/hosts/host-a/containers')
      .query({ organizationId: 'org-a', hostIds: 'host-a,host-outside' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('hostIds');
  });

  it('denies cross-tenant requests when scope cannot be resolved', async () => {
    const res = await request(app).get('/hosts').query({ organizationId: 'org-b', projectId: 'proj-b' });

    expect(res.status).toBe(403);
  });
});
