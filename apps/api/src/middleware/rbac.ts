import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

// RBAC types matching Prisma enums
export type OrgRole = 'OWNER' | 'ADMIN' | 'OPERATOR' | 'VIEWER';
export type ProjectRole = 'OWNER' | 'ADMIN' | 'OPERATOR' | 'VIEWER';

// Extended Express Request with role info from auth.ts

/**
 * requireOrgRole - Middleware to check user's organization role
 * 
 * Usage: router.post('/invite', requireOrgRole('OWNER', 'ADMIN'), handler)
 * 
 * Checks:
 * 1. User is authenticated
 * 2. User is a member of the organization
 * 3. User's role is in the allowed roles list
 */
export function requireOrgRole(...allowedRoles: OrgRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // Get organization ID from params or body
      const orgId = req.params.orgId || req.params.organizationId || req.body.organizationId;
      if (!orgId) {
        res.status(400).json({ error: 'Organization ID is required' });
        return;
      }

      // Check user's membership in the organization
      const membership = await prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId,
            organizationId: orgId,
          },
        },
      });

      if (!membership) {
        res.status(403).json({ error: 'Not a member of this organization' });
        return;
      }

      // Check if user's role is in the allowed list
      if (!allowedRoles.includes(membership.role)) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      // Attach role info to request
      req.user = {
        id: req.user!.id,
        email: req.user!.email,
        name: req.user!.name,
        orgRole: membership.role,
        organizationId: orgId as string,
      };

      next();
    } catch (error) {
      console.error('requireOrgRole middleware error:', error);
      res.status(500).json({ error: 'Authorization error' });
    }
  };
}

/**
 * requireProjectRole - Middleware to check user's project role
 * 
 * Usage: router.delete('/:projectId', requireProjectRole('OWNER', 'ADMIN'), handler)
 * 
 * Checks:
 * 1. User is authenticated
 * 2. User is a member of the project (or inherits from org)
 * 3. User's effective role is in the allowed roles list
 * 
 * Note: If inheritedFromOrg is true, the project role is derived from org membership
 */
export function requireProjectRole(...allowedRoles: ProjectRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // Get project ID from params or body
      const projectId = req.params.projectId || req.body.projectId;
      if (!projectId) {
        res.status(400).json({ error: 'Project ID is required' });
        return;
      }

      // Get the project with organization info
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          organization: {
            include: {
              members: {
                where: { userId },
              },
            },
          },
        },
      });

      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      // Check if user is a member of the organization
      const orgMember = project.organization.members[0];
      if (!orgMember) {
        res.status(403).json({ error: 'Not a member of this organization' });
        return;
      }

      // Check project membership
      const projectMember = await prisma.projectMember.findUnique({
        where: {
          userId_projectId: {
            userId,
            projectId,
          },
        },
      });

      // Determine effective role: use project role if explicitly set, otherwise inherit from org
      let effectiveRole: ProjectRole;
      if (projectMember && !projectMember.inheritedFromOrg) {
        effectiveRole = projectMember.role;
      } else {
        effectiveRole = orgMember.role as ProjectRole;
      }

      // Check if effective role is in the allowed list
      if (!allowedRoles.includes(effectiveRole)) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      // Attach role info to request
      req.user = {
        id: req.user!.id,
        email: req.user!.email,
        name: req.user!.name,
        projectRole: effectiveRole,
        organizationId: project.organizationId,
        projectId: projectId as string,
      };

      next();
    } catch (error) {
      console.error('requireProjectRole middleware error:', error);
      res.status(500).json({ error: 'Authorization error' });
    }
  };
}

/**
 * getEffectiveOrgRole - Helper to get user's effective organization role
 * Returns the role if user is a member, null otherwise
 */
export async function getEffectiveOrgRole(
  userId: string,
  organizationId: string
): Promise<OrgRole | null> {
  const membership = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
  });

  return membership?.role ?? null;
}

/**
 * getEffectiveProjectRole - Helper to get user's effective project role
 * Returns the project role (or inherited org role if inheritedFromOrg is true)
 */
export async function getEffectiveProjectRole(
  userId: string,
  projectId: string
): Promise<ProjectRole | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      organization: {
        include: {
          members: {
            where: { userId },
          },
        },
      },
    },
  });

  if (!project) {
    return null;
  }

  const orgMember = project.organization.members[0];
  if (!orgMember) {
    return null;
  }

  const projectMember = await prisma.projectMember.findUnique({
    where: {
      userId_projectId: {
        userId,
        projectId,
      },
    },
  });

  if (projectMember && !projectMember.inheritedFromOrg) {
    return projectMember.role;
  }

  return orgMember.role as ProjectRole;
}
