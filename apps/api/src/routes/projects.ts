import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { requireOrgScope } from '../middleware/scope';
import { canCreateProject, canManageProject } from '../authz/roleMatrix';

const router = Router();

// Apply requireAuth to all project routes
router.use(requireAuth);

// GET /organizations/:orgId/projects - List projects in organization
router.get('/:orgId/projects', requireOrgScope(), async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.scope!;

    const projects = await prisma.project.findMany({
      where: { organizationId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true, name: true },
            },
          },
        },
        _count: {
          select: {
            hosts: true,
            webhooks: true,
            alertRules: true,
          },
        },
      },
    });

    // For each project, also count firing alerts (alerts where container's host belongs to this project)
    const projectsWithAlerts = await Promise.all(
      projects.map(async (project) => {
        const firingAlerts = await prisma.alert.count({
          where: {
            status: 'FIRING',
            container: {
              host: {
                projectId: project.id,
                organizationId,
              },
            },
          },
        });
        return { ...project, firingAlerts };
      })
    );

    res.json({ projects: projectsWithAlerts });
  } catch (error) {
    console.error('List projects error:', error);
    res.status(500).json({ error: 'Failed to list projects' });
  }
});

// POST /organizations/:orgId/projects - Create project in organization
router.post('/:orgId/projects', requireOrgScope(), async (req: Request, res: Response) => {
  try {
    const { userId, organizationId, role } = req.scope!;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    if (!canCreateProject(role)) {
      return res.status(403).json({ error: 'Insufficient permissions to create projects' });
    }

    const project = await prisma.project.create({
      data: {
        name,
        organizationId,
        members: {
          create: {
            userId,
            role: role === 'OWNER' ? 'OWNER' : 'ADMIN',
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
router.get('/:orgId/projects/:id', requireOrgScope(), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { organizationId } = req.scope!;

    const project = await prisma.project.findFirst({
      where: { id, organizationId },
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
router.patch('/:orgId/projects/:id', requireOrgScope(), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { organizationId, role } = req.scope!;
    const { name } = req.body;

    if (!canManageProject(role)) {
      return res.status(403).json({ error: 'Insufficient permissions to update project' });
    }

    const project = await prisma.project.findFirst({
      where: { id, organizationId },
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
router.delete('/:orgId/projects/:id', requireOrgScope(), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { organizationId, role } = req.scope!;

    if (!canManageProject(role)) {
      return res.status(403).json({ error: 'Insufficient permissions to delete project' });
    }

    const project = await prisma.project.findFirst({
      where: { id, organizationId },
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
