import type { OrgRole, ProjectRole } from '@prisma/client';

export type ScopeRole = OrgRole | ProjectRole;

const roleRank: Record<ScopeRole, number> = {
  VIEWER: 10,
  OPERATOR: 20,
  ADMIN: 30,
  OWNER: 40,
};

export function hasMinimumRole(role: ScopeRole, minimumRole: ScopeRole): boolean {
  return roleRank[role] >= roleRank[minimumRole];
}

export function canManageOrganization(role: ScopeRole): boolean {
  return hasMinimumRole(role, 'ADMIN');
}

export function canCreateProject(role: ScopeRole): boolean {
  return hasMinimumRole(role, 'OPERATOR');
}

export function canManageProject(role: ScopeRole): boolean {
  return hasMinimumRole(role, 'ADMIN');
}

export function canDeleteOrganization(role: ScopeRole): boolean {
  return role === 'OWNER';
}
