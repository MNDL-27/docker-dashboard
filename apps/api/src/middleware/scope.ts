import type { NextFunction, Request, Response } from 'express';
import type { OrgRole } from '@prisma/client';
import { prisma } from '../lib/prisma';

export interface OrganizationScope {
  userId: string;
  organizationId: string;
  role: OrgRole;
}

declare global {
  namespace Express {
    interface Request {
      scope?: OrganizationScope;
    }
  }
}

interface RequireOrgScopeOptions {
  paramKey?: string;
  bodyKey?: string;
  queryKey?: string;
}

function resolveOrganizationId(req: Request, options: RequireOrgScopeOptions): string | undefined {
  const paramKey = options.paramKey ?? 'orgId';
  const bodyKey = options.bodyKey ?? 'organizationId';
  const queryKey = options.queryKey ?? 'organizationId';

  const fromParams = req.params[paramKey] ?? (paramKey !== 'id' ? req.params.id : undefined);
  const fromBody = typeof req.body?.[bodyKey] === 'string' ? req.body[bodyKey] : undefined;
  const queryValue = req.query?.[queryKey];
  const fromQuery = typeof queryValue === 'string' ? queryValue : undefined;

  return fromParams ?? fromBody ?? fromQuery;
}

export function requireOrgScope(options: RequireOrgScopeOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const organizationId = resolveOrganizationId(req, options);
      if (!organizationId) {
        res.status(400).json({ error: 'Organization ID is required' });
        return;
      }

      const membership = await prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId,
            organizationId,
          },
        },
      });

      if (!membership) {
        res.status(403).json({ error: 'Not a member of this organization' });
        return;
      }

      req.scope = {
        userId,
        organizationId,
        role: membership.role,
      };

      next();
    } catch (error) {
      console.error('Organization scope resolution error:', error);
      res.status(500).json({ error: 'Authorization error' });
    }
  };
}
