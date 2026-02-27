import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Apply requireAuth to all project routes
router.use(requireAuth);

// Helper: Check org membership and get role
async function checkOrgMembership(userId: string, orgId: string) {
  return prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId: orgId,
      },
    },
  });
}

// GET /organizations/:orgId/projects - List projects in organization
router.get('/:orgId/projects', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { orgId } = req.params;

    // Check org membership
    const membership = await checkOrgMembership(userId, orgId);
    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this organization' });
    }

    const projects = await prisma.project.findMany({
      where: { organizationId: orgId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true, name: true },
            },
          },
        },
      },
    });

    res.json({ projects });
  } catch (error) {
    console.error('List projects error:', error);
    res.status(500).json({ error: 'Failed to list projects' });
  }
});

// POST /organizations/:orgId/projects - Create project in organization
router.post('/:orgId/projects', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { orgId } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    // Check org membership and role
    const membership = await checkOrgMembership(userId, orgId);
    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this organization' });
    }

    // Only ADMIN, OPERATOR, and OWNER can create projects
    if (membership.role === 'VIEWER') {
      return res.status(403).json({ error: 'Insufficient permissions to create projects' });
    }

    const project = await prisma.project.create({
      data: {
        name,
        organizationId: orgId,
        members: {
          create: {
            userId,
            role: membership.role === 'OWNER' ? 'OWNER' : 'ADMIN',
            inheritedFromOrg: false,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true, name: true },
            },
          },
        },
      },
    });

    res.status(201).json({ project });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// GET /organizations/:orgId/projects/:id - Get single project
router.get('/:orgId/projects/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { orgId, id } = req.params;

    // Check org membership
    const membership = await checkOrgMembership(userId, orgId);
    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this organization' });
    }

    const project = await prisma.project.findFirst({
      where: { id, organizationId: orgId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true, name: true },
            },
          },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ project });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Failed to get project' });
  }
});

// PATCH /organizations/:orgId/projects/:id - Update project
router.patch('/:orgId/projects/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { orgId, id } = req.params;
    const { name } = req.body;

    // Check org membership and role
    const membership = await checkOrgMembership(userId, orgId);
    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this organization' });
    }

    // Only ADMIN and OWNER can update projects
    if (membership.role === 'VIEWER' || membership.role === 'OPERATOR') {
      return res.status(403).json({ error: 'Insufficient permissions to update project' });
    }

    const project = await prisma.project.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const updatedProject = await prisma.project.update({
      where: { id },
      data: { name },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true, name: true },
            },
          },
        },
      },
    });

    res.json({ project: updatedProject });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// DELETE /organizations/:orgId/projects/:id - Delete project
router.delete('/:orgId/projects/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { orgId, id } = req.params;

    // Check org membership and role
    const membership = await checkOrgMembership(userId, orgId);
    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this organization' });
    }

    // Only OWNER and ADMIN can delete projects
    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Insufficient permissions to delete project' });
    }

    const project = await prisma.project.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Delete project (cascades to members)
    await prisma.project.delete({
      where: { id },
    });

    res.json({ success: true, message: 'Project deleted' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

export default router;
