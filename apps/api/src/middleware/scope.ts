import type { NextFunction, Request, Response } from 'express';
import type { OrgRole } from '@prisma/client';
import { hasMinimumRole } from '../authz/roleMatrix';
import { resolveUserScope } from '../services/scopedAccess';

export interface OrganizationScope {
  userId: string;
  organizationId: string;
  projectId?: string;
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
  headerKey?: string;
  projectParamKey?: string;
  projectBodyKey?: string;
  projectQueryKey?: string;
  projectHeaderKey?: string;
}

interface RequireOrgPermissionOptions extends RequireOrgScopeOptions {
  minimumRole?: OrgRole;
  allowedRoles?: OrgRole[];
  denialMessage?: string;
}

function resolveOrganizationId(req: Request, options: RequireOrgScopeOptions): string | undefined {
  const paramKey = options.paramKey ?? 'orgId';
  const bodyKey = options.bodyKey ?? 'organizationId';
  const queryKey = options.queryKey ?? 'organizationId';
  const headerKey = options.headerKey ?? 'x-organization-id';

  const fromParams = req.params[paramKey] ?? (paramKey !== 'id' ? req.params.id : undefined);
  const fromBody = typeof req.body?.[bodyKey] === 'string' ? req.body[bodyKey] : undefined;
  const queryValue = req.query?.[queryKey];
  const fromQuery = typeof queryValue === 'string' ? queryValue : undefined;
  const headerValue = req.headers[headerKey];
  const fromHeader = typeof headerValue === 'string' ? headerValue : undefined;

  return fromParams ?? fromBody ?? fromQuery ?? fromHeader;
}

function resolveProjectId(req: Request, options: RequireOrgScopeOptions): string | undefined {
  const projectParamKey = options.projectParamKey ?? 'projectId';
  const projectBodyKey = options.projectBodyKey ?? 'projectId';
  const projectQueryKey = options.projectQueryKey ?? 'projectId';
  const projectHeaderKey = options.projectHeaderKey ?? 'x-project-id';

  const fromParams = req.params[projectParamKey];
  const fromBody = typeof req.body?.[projectBodyKey] === 'string' ? req.body[projectBodyKey] : undefined;
  const queryValue = req.query?.[projectQueryKey];
  const fromQuery = typeof queryValue === 'string' ? queryValue : undefined;
  const headerValue = req.headers[projectHeaderKey];
  const fromHeader = typeof headerValue === 'string' ? headerValue : undefined;

  const resolved = fromParams ?? fromBody ?? fromQuery ?? fromHeader;
  if (resolved === 'null' || resolved === '') {
    return undefined;
  }

  return resolved;
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

      const projectId = resolveProjectId(req, options);

      const scope = await resolveUserScope({
        userId,
        organizationId,
        projectId,
      });

      if (!scope) {
        res.status(403).json({ error: 'Not a member of this organization' });
        return;
      }

      req.scope = {
        userId: scope.userId,
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        role: scope.role,
      };

      next();
    } catch (error) {
      console.error('Organization scope resolution error:', error);
      res.status(500).json({ error: 'Authorization error' });
    }
  };
}

export function requireOrgPermission(options: RequireOrgPermissionOptions = {}) {
  const {
    minimumRole,
    allowedRoles,
    denialMessage = 'Insufficient permissions',
    ...scopeOptions
  } = options;

  const resolveScope = requireOrgScope(scopeOptions);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await resolveScope(req, res, () => {
      const scope = req.scope;
      if (!scope) {
        res.status(500).json({ error: 'Authorization scope not resolved' });
        return;
      }

      if (allowedRoles && !allowedRoles.includes(scope.role)) {
        res.status(403).json({ error: denialMessage });
        return;
      }

      if (minimumRole && !hasMinimumRole(scope.role, minimumRole)) {
        res.status(403).json({ error: denialMessage });
        return;
      }

      next();
    });
  };
}
