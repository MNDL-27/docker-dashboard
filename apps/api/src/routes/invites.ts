import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { requireOrgRole, OrgRole } from '../middleware/rbac';
import { randomBytes } from 'crypto';

const router = Router();

// Apply requireAuth to all invitation routes
router.use(requireAuth);

/**
 * POST /organizations/:orgId/invite
 * 
 * Create an invitation to join an organization
 * Requires: OWNER or ADMIN role
 */
router.post(
  '/organizations/:orgId/invite',
  requireOrgRole('OWNER', 'ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const { orgId } = req.params;
      const { email, role = 'VIEWER' } = req.body;
      const inviterUserId = req.user!.id;

      // Validate email
      if (!email || typeof email !== 'string') {
        res.status(400).json({ error: 'Email is required' });
        return;
      }

      // Validate role
      const validRoles: OrgRole[] = ['OWNER', 'ADMIN', 'OPERATOR', 'VIEWER'];
      if (!validRoles.includes(role)) {
        res.status(400).json({ error: 'Invalid role' });
        return;
      }

      // Check if user is already a member
      const existingMember = await prisma.organizationMember.findFirst({
        where: {
          organizationId: orgId,
          user: {
            email: email.toLowerCase(),
          },
        },
      });

      if (existingMember) {
        res.status(400).json({ error: 'User is already a member of this organization' });
        return;
      }

      // Check for pending invite
      const existingInvite = await prisma.organizationInvite.findFirst({
        where: {
          organizationId: orgId,
          email: email.toLowerCase(),
          acceptedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
      });

      if (existingInvite) {
        res.status(400).json({ error: 'Invitation already sent to this email' });
        return;
      }

      // Generate secure token
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // Create invitation
      const invite = await prisma.organizationInvite.create({
        data: {
          email: email.toLowerCase(),
          organizationId: orgId,
          role: role as OrgRole,
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

      // TODO: Send invitation email (stub)
      console.log(`[EMAIL STUB] Invitation sent to ${email} for org ${invite.organization.name}`);
      console.log(`[EMAIL STUB] Invitation token: ${token}`);
      console.log(`[EMAIL STUB] Accept at: /invites/${token}`);

      res.status(201).json({
        invite: {
          id: invite.id,
          email: invite.email,
          role: invite.role,
          organization: invite.organization,
          expiresAt: invite.expiresAt,
          // In production, don't return the raw token - send via email instead
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

/**
 * GET /invites/:token
 * 
 * Get invitation details (public endpoint)
 * Does not require authentication
 */
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
      res.status(400).json({ error: 'Invitation has already been used' });
      return;
    }

    if (invite.expiresAt < new Date()) {
      res.status(400).json({ error: 'Invitation has expired' });
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

/**
 * POST /invites/:token/accept
 * 
 * Accept an invitation and join the organization
 * Requires: Authentication, must be logged in as the invited email
 */
router.post('/invites/:token/accept', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const userId = req.user?.id;
    const userEmail = req.user?.email;

    if (!userId) {
      res.status(401).json({ error: 'Authentication required to accept invitation' });
      return;
    }

    // Find the invitation
    const invite = await prisma.organizationInvite.findUnique({
      where: { token },
      include: {
        organization: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    if (!invite) {
      res.status(404).json({ error: 'Invitation not found' });
      return;
    }

    if (invite.acceptedAt) {
      res.status(400).json({ error: 'Invitation has already been used' });
      return;
    }

    if (invite.expiresAt < new Date()) {
      res.status(400).json({ error: 'Invitation has expired' });
      return;
    }

    // Verify the logged-in user matches the invited email
    if (userEmail?.toLowerCase() !== invite.email.toLowerCase()) {
      res.status(403).json({ 
        error: 'You can only accept invitations sent to your email address',
        invitedEmail: invite.email,
      });
      return;
    }

    // Check if user is already a member
    const existingMember = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: invite.organizationId,
        },
      },
    });

    if (existingMember) {
      res.status(400).json({ error: 'You are already a member of this organization' });
      return;
    }

    // Accept invitation: create membership and mark invite as accepted
    const [membership] = await prisma.$transaction([
      prisma.organizationMember.create({
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
      }),
      prisma.organizationInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      }),
    ]);

    res.status(201).json({
      membership,
      message: `Successfully joined ${invite.organization.name}`,
    });
  } catch (error) {
    console.error('Accept invitation error:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

/**
 * GET /organizations/:orgId/members
 * 
 * List all members of an organization
 * Requires: Authentication and org membership
 */
router.get('/organizations/:orgId/members', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const userId = req.user!.id;

    // Check membership
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

    // Get all members
    const members = await prisma.organizationMember.findMany({
      where: { organizationId: orgId },
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
      members: members.map((m) => ({
        id: m.id,
        role: m.role,
        joinedAt: m.createdAt,
        user: m.user,
      })),
    });
  } catch (error) {
    console.error('List members error:', error);
    res.status(500).json({ error: 'Failed to list members' });
  }
});

/**
 * DELETE /organizations/:orgId/members/:memberId
 * 
 * Remove a member from an organization
 * Requires: OWNER or ADMIN role
 */
router.delete(
  '/organizations/:orgId/members/:memberId',
  requireOrgRole('OWNER', 'ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const { orgId, memberId } = req.params;
      const currentUserId = req.user!.id;

      // Get the member to be removed
      const memberToRemove = await prisma.organizationMember.findUnique({
        where: { id: memberId },
      });

      if (!memberToRemove) {
        res.status(404).json({ error: 'Member not found' });
        return;
      }

      if (memberToRemove.organizationId !== orgId) {
        res.status(400).json({ error: 'Member does not belong to this organization' });
        return;
      }

      // Cannot remove the owner
      if (memberToRemove.role === 'OWNER') {
        res.status(400).json({ error: 'Cannot remove the organization owner' });
        return;
      }

      // Check if current user can remove this member
      const currentUserMembership = await prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: currentUserId,
            organizationId: orgId,
          },
        },
      });

      // OWNER can remove anyone except other OWNERs
      // ADMIN can remove OPERATORs and VIEWERs
      if (currentUserMembership?.role === 'ADMIN' && memberToRemove.role !== 'VIEWER' && memberToRemove.role !== 'OPERATOR') {
        res.status(403).json({ error: 'Admins can only remove Operators and Viewers' });
        return;
      }

      // Cannot remove yourself
      if (memberToRemove.userId === currentUserId) {
        res.status(400).json({ error: 'Cannot remove yourself from the organization' });
        return;
      }

      // Remove member
      await prisma.organizationMember.delete({
        where: { id: memberId },
      });

      // Also remove from all projects in the org
      await prisma.projectMember.deleteMany({
        where: {
          userId: memberToRemove.userId,
          project: {
            organizationId: orgId,
          },
        },
      });

      res.json({ success: true, message: 'Member removed successfully' });
    } catch (error) {
      console.error('Remove member error:', error);
      res.status(500).json({ error: 'Failed to remove member' });
    }
  }
);

/**
 * PATCH /organizations/:orgId/members/:memberId
 * 
 * Update a member's role in an organization
 * Requires: OWNER or ADMIN role
 */
router.patch(
  '/organizations/:orgId/members/:memberId',
  requireOrgRole('OWNER', 'ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const { orgId, memberId } = req.params;
      const { role } = req.body;
      const currentUserId = req.user!.id;

      // Validate role
      const validRoles: OrgRole[] = ['ADMIN', 'OPERATOR', 'VIEWER'];
      if (!role || !validRoles.includes(role)) {
        res.status(400).json({ error: 'Invalid role. Must be ADMIN, OPERATOR, or VIEWER' });
        return;
      }

      // Get the member to be updated
      const memberToUpdate = await prisma.organizationMember.findUnique({
        where: { id: memberId },
      });

      if (!memberToUpdate) {
        res.status(404).json({ error: 'Member not found' });
        return;
      }

      if (memberToUpdate.organizationId !== orgId) {
        res.status(400).json({ error: 'Member does not belong to this organization' });
        return;
      }

      // Cannot change the owner's role
      if (memberToUpdate.role === 'OWNER') {
        res.status(400).json({ error: 'Cannot change the organization owner role' });
        return;
      }

      // Get current user's membership
      const currentUserMembership = await prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: currentUserId,
            organizationId: orgId,
          },
        },
      });

      // Only OWNER can assign ADMIN role
      if (role === 'ADMIN' && currentUserMembership?.role !== 'OWNER') {
        res.status(403).json({ error: 'Only owners can assign Admin role' });
        return;
      }

      // Update the member's role
      const updatedMember = await prisma.organizationMember.update({
        where: { id: memberId },
        data: { role },
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
