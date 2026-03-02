import type { OrgRole, ProjectRole } from '@prisma/client';

export type ScopeRole = OrgRole | ProjectRole;

export interface OrgRoleMutationResult {
  allowed: boolean;
  reason?: string;
}

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

export function canInviteMember(actorRole: OrgRole, targetRole: OrgRole): OrgRoleMutationResult {
  if (!hasMinimumRole(actorRole, 'ADMIN')) {
    return { allowed: false, reason: 'Only owners and admins can invite members' };
  }

  if (actorRole === 'ADMIN' && (targetRole === 'OWNER' || targetRole === 'ADMIN')) {
    return { allowed: false, reason: 'Admins can only invite Operators and Viewers' };
  }

  return { allowed: true };
}

export function canUpdateMemberRole(
  actorRole: OrgRole,
  targetRole: OrgRole,
  nextRole: OrgRole,
  isSelf: boolean
): OrgRoleMutationResult {
  if (!hasMinimumRole(actorRole, 'ADMIN')) {
    return { allowed: false, reason: 'Only owners and admins can update member roles' };
  }

  if (targetRole === 'OWNER') {
    return { allowed: false, reason: 'Cannot change the organization owner role' };
  }

  if (isSelf) {
    return { allowed: false, reason: 'Cannot change your own role' };
  }

  if (nextRole === 'OWNER') {
    return { allowed: false, reason: 'Owner role cannot be assigned through this endpoint' };
  }

  if (actorRole === 'ADMIN') {
    if (targetRole === 'ADMIN') {
      return { allowed: false, reason: 'Admins cannot change other Admin members' };
    }

    if (nextRole === 'ADMIN') {
      return { allowed: false, reason: 'Only owners can assign Admin role' };
    }
  }

  return { allowed: true };
}

export function canRemoveMember(actorRole: OrgRole, targetRole: OrgRole, isSelf: boolean): OrgRoleMutationResult {
  if (!hasMinimumRole(actorRole, 'ADMIN')) {
    return { allowed: false, reason: 'Only owners and admins can remove members' };
  }

  if (isSelf) {
    return { allowed: false, reason: 'Cannot remove yourself from the organization' };
  }

  if (targetRole === 'OWNER') {
    return { allowed: false, reason: 'Cannot remove the organization owner' };
  }

  if (actorRole === 'ADMIN' && targetRole === 'ADMIN') {
    return { allowed: false, reason: 'Admins can only remove Operators and Viewers' };
  }

  return { allowed: true };
}
