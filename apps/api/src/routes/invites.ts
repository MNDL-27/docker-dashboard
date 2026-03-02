import { randomBytes } from 'crypto';
import type { OrgRole } from '@prisma/client';
import { Router, Request, Response } from 'express';
import {
  canInviteMember,
  canRemoveMember,
  canUpdateMemberRole,
} from '../authz/roleMatrix';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { requireOrgPermission, requireOrgScope } from '../middleware/scope';

const router = Router();
const INVITE_EXPIRATION_DAYS = 7;
const ASSIGNABLE_ROLES: OrgRole[] = ['ADMIN', 'OPERATOR', 'VIEWER'];
const INVITABLE_ROLES: OrgRole[] = ['ADMIN', 'OPERATOR', 'VIEWER'];

class InviteFlowError extends Error {
  status: number;
  payload?: Record<string, unknown>;

  constructor(status: number, message: string, payload?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

router.post(
  '/organizations/:orgId/invite',
  requireAuth,
  requireOrgPermission({ minimumRole: 'ADMIN' }),
  async (req: Request, res: Response) => {
    try {
      const { organizationId, role: actorRole } = req.scope!;
      const inviterUserId = req.user!.id;
      const emailInput = req.body?.email;
      const requestedRole = req.body?.role as OrgRole | undefined;

      if (!emailInput || typeof emailInput !== 'string') {
        res.status(400).json({ error: 'Email is required' });
        return;
      }

      const inviteRole = requestedRole ?? 'VIEWER';
      if (!INVITABLE_ROLES.includes(inviteRole)) {
        res.status(400).json({ error: 'Invalid role. Must be ADMIN, OPERATOR, or VIEWER' });
        return;
      }

      const invitePermission = canInviteMember(actorRole, inviteRole);
      if (!invitePermission.allowed) {
        res.status(403).json({ error: invitePermission.reason ?? 'Insufficient permissions' });
        return;
      }

      const normalizedEmail = normalizeEmail(emailInput);

      const existingMember = await prisma.organizationMember.findFirst({
        where: {
          organizationId,
          user: {
            email: normalizedEmail,
          },
        },
      });

      if (existingMember) {
        res.status(409).json({ error: 'User is already a member of this organization' });
        return;
      }

      const existingInvite = await prisma.organizationInvite.findFirst({
        where: {
          organizationId,
          email: normalizedEmail,
          acceptedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
      });

      if (existingInvite) {
        res.status(409).json({ error: 'Invitation already sent to this email' });
        return;
      }

      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + INVITE_EXPIRATION_DAYS * 24 * 60 * 60 * 1000);

      const invite = await prisma.organizationInvite.create({
        data: {
          email: normalizedEmail,
          organizationId,
          role: inviteRole,
          inviterUserId,
          token,
          expiresAt,
        },
        include: {
          organization: {
            select: { id: true, name: true, slug: true },
          },
        },
      });

      res.status(201).json({
        invite: {
          id: invite.id,
          email: invite.email,
          role: invite.role,
          organization: invite.organization,
          expiresAt: invite.expiresAt,
          inviteUrl: `/invites/${token}`,
        },
        message: 'Invitation created successfully',
      });
    } catch (error) {
      console.error('Create invitation error:', error);
      res.status(500).json({ error: 'Failed to create invitation' });
    }
  }
);

router.get('/invites/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const invite = await prisma.organizationInvite.findUnique({
      where: { token },
      include: {
        organization: {
          select: { id: true, name: true, slug: true },
        },
        inviter: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!invite) {
      res.status(404).json({ error: 'Invitation not found' });
      return;
    }

    if (invite.acceptedAt) {
      res.status(409).json({ error: 'Invitation has already been used' });
      return;
    }

    if (invite.expiresAt < new Date()) {
      res.status(410).json({ error: 'Invitation has expired' });
      return;
    }

    res.json({
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        organization: invite.organization,
        invitedBy: invite.inviter.name || invite.inviter.email,
        expiresAt: invite.expiresAt,
      },
    });
  } catch (error) {
    console.error('Get invitation error:', error);
    res.status(500).json({ error: 'Failed to get invitation' });
  }
});

router.post('/invites/:token/accept', requireAuth, async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const userId = req.user!.id;
    const userEmail = normalizeEmail(req.user!.email);

    const accepted = await prisma.$transaction(async (tx) => {
      const invite = await tx.organizationInvite.findUnique({
        where: { token },
        include: {
          organization: {
            select: { id: true, name: true, slug: true },
          },
        },
      });

      if (!invite) {
        throw new InviteFlowError(404, 'Invitation not found');
      }

      if (invite.acceptedAt) {
        throw new InviteFlowError(409, 'Invitation has already been used');
      }

      if (invite.expiresAt < new Date()) {
        throw new InviteFlowError(410, 'Invitation has expired');
      }

      if (userEmail !== normalizeEmail(invite.email)) {
        throw new InviteFlowError(403, 'You can only accept invitations sent to your email address', {
          invitedEmail: invite.email,
        });
      }

      const existingMember = await tx.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId,
            organizationId: invite.organizationId,
          },
        },
      });

      if (existingMember) {
        throw new InviteFlowError(409, 'You are already a member of this organization');
      }

      const membership = await tx.organizationMember.create({
        data: {
          userId,
          organizationId: invite.organizationId,
          role: invite.role,
        },
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
          organization: {
            select: { id: true, name: true, slug: true },
          },
        },
      });

      const consumeInvite = await tx.organizationInvite.updateMany({
        where: {
          id: invite.id,
          acceptedAt: null,
        },
        data: { acceptedAt: new Date() },
      });

      if (consumeInvite.count !== 1) {
        throw new InviteFlowError(409, 'Invitation has already been used');
      }

      return {
        membership,
        organizationName: invite.organization.name,
      };
    });

    res.status(201).json({
      membership: accepted.membership,
      message: `Successfully joined ${accepted.organizationName}`,
    });
  } catch (error) {
    if (error instanceof InviteFlowError) {
      res.status(error.status).json({ error: error.message, ...error.payload });
      return;
    }

    console.error('Accept invitation error:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

router.get(
  '/organizations/:orgId/members',
  requireAuth,
  requireOrgScope(),
  async (req: Request, res: Response) => {
    try {
      const { organizationId } = req.scope!;

      const members = await prisma.organizationMember.findMany({
        where: { organizationId },
        include: {
          user: {
            select: { id: true, email: true, name: true, createdAt: true },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      res.json({
        members: members.map((member) => ({
          id: member.id,
          role: member.role,
          joinedAt: member.createdAt,
          user: member.user,
        })),
      });
    } catch (error) {
      console.error('List members error:', error);
      res.status(500).json({ error: 'Failed to list members' });
    }
  }
);

router.delete(
  '/organizations/:orgId/members/:memberId',
  requireAuth,
  requireOrgPermission({ minimumRole: 'ADMIN' }),
  async (req: Request, res: Response) => {
    try {
      const { memberId } = req.params;
      const { organizationId, role: actorRole, userId: actorUserId } = req.scope!;

      const memberToRemove = await prisma.organizationMember.findFirst({
        where: {
          id: memberId,
          organizationId,
        },
      });

      if (!memberToRemove) {
        res.status(404).json({ error: 'Member not found' });
        return;
      }

      const removalCheck = canRemoveMember(
        actorRole,
        memberToRemove.role,
        memberToRemove.userId === actorUserId
      );

      if (!removalCheck.allowed) {
        res.status(403).json({ error: removalCheck.reason ?? 'Insufficient permissions' });
        return;
      }

      await prisma.$transaction([
        prisma.organizationMember.delete({
          where: { id: memberId },
        }),
        prisma.projectMember.deleteMany({
          where: {
            userId: memberToRemove.userId,
            project: {
              organizationId,
            },
          },
        }),
      ]);

      res.json({ success: true, message: 'Member removed successfully' });
    } catch (error) {
      console.error('Remove member error:', error);
      res.status(500).json({ error: 'Failed to remove member' });
    }
  }
);

router.patch(
  '/organizations/:orgId/members/:memberId',
  requireAuth,
  requireOrgPermission({ minimumRole: 'ADMIN' }),
  async (req: Request, res: Response) => {
    try {
      const { memberId } = req.params;
      const { role: actorRole, userId: actorUserId, organizationId } = req.scope!;
      const requestedRole = req.body?.role as OrgRole | undefined;

      if (!requestedRole || !ASSIGNABLE_ROLES.includes(requestedRole)) {
        res.status(400).json({ error: 'Invalid role. Must be ADMIN, OPERATOR, or VIEWER' });
        return;
      }

      const memberToUpdate = await prisma.organizationMember.findFirst({
        where: {
          id: memberId,
          organizationId,
        },
      });

      if (!memberToUpdate) {
        res.status(404).json({ error: 'Member not found' });
        return;
      }

      const roleUpdateCheck = canUpdateMemberRole(
        actorRole,
        memberToUpdate.role,
        requestedRole,
        memberToUpdate.userId === actorUserId
      );

      if (!roleUpdateCheck.allowed) {
        res.status(403).json({ error: roleUpdateCheck.reason ?? 'Insufficient permissions' });
        return;
      }

      const updatedMember = await prisma.organizationMember.update({
        where: { id: memberId },
        data: { role: requestedRole },
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
      });

      res.json({
        member: {
          id: updatedMember.id,
          role: updatedMember.role,
          user: updatedMember.user,
        },
        message: 'Member role updated successfully',
      });
    } catch (error) {
      console.error('Update member role error:', error);
      res.status(500).json({ error: 'Failed to update member role' });
    }
  }
);

export default router;
