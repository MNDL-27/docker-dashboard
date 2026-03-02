import type { OrgRole, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

export interface ResolvedScope {
  userId: string;
  organizationId: string;
  projectId?: string;
  role: OrgRole;
}

interface ResolveUserScopeInput {
  userId?: string;
  organizationId?: string;
  projectId?: string;
}

interface ResolveAgentScopeInput {
  hostId?: string;
  organizationId?: string;
  projectId?: string;
}

export async function resolveUserScope(input: ResolveUserScopeInput): Promise<ResolvedScope | null> {
  const { userId, organizationId, projectId } = input;

  if (!userId || !organizationId) {
    return null;
  }

  const membership = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
    select: {
      role: true,
    },
  });

  if (!membership) {
    return null;
  }

  if (projectId) {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId,
      },
      select: { id: true },
    });

    if (!project) {
      return null;
    }
  }

  return {
    userId,
    organizationId,
    projectId,
    role: membership.role,
  };
}

export async function resolveAgentScope(input: ResolveAgentScopeInput): Promise<boolean> {
  const { hostId, organizationId, projectId } = input;

  if (!hostId || !organizationId || !projectId) {
    return false;
  }

  const host = await prisma.host.findFirst({
    where: {
      id: hostId,
      organizationId,
      projectId,
    },
    select: { id: true },
  });

  return Boolean(host);
}

export function scopedHostWhere(
  scope: Pick<ResolvedScope, 'organizationId' | 'projectId'>,
  extra: Prisma.HostWhereInput = {}
): Prisma.HostWhereInput {
  return {
    organizationId: scope.organizationId,
    ...(scope.projectId ? { projectId: scope.projectId } : {}),
    ...extra,
  };
}

export function scopedContainerWhere(
  scope: Pick<ResolvedScope, 'organizationId' | 'projectId'>,
  extra: Prisma.ContainerWhereInput = {}
): Prisma.ContainerWhereInput {
  return {
    host: scopedHostWhere(scope),
    ...extra,
  };
}
