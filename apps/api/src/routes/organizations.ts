import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { requireOrgScope } from '../middleware/scope';
import { canDeleteOrganization, canManageOrganization } from '../authz/roleMatrix';

const router = Router();

// Apply requireAuth to all organization routes
router.use(requireAuth);

// GET /organizations - List user's organizations
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const memberships = await prisma.organizationMember.findMany({
      where: { userId },
      include: {
        organization: {
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, email: true, name: true },
                },
              },
            },
          },
        },
      },
    });

    const organizations = memberships.map((m) => ({
      ...m.organization,
      role: m.role,
    }));

    res.json({ organizations });
  } catch (error) {
    console.error('List organizations error:', error);
    res.status(500).json({ error: 'Failed to list organizations' });
  }
});

// POST /organizations - Create new organization
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { name, slug } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Organization name is required' });
    }

    // Generate slug from name if not provided
    const orgSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Check for duplicate slug
    const existingOrg = await prisma.organization.findUnique({
      where: { slug: orgSlug },
    });

    if (existingOrg) {
      return res.status(400).json({ error: 'Organization slug already exists' });
    }

    // Create organization with owner as member
    const organization = await prisma.organization.create({
      data: {
        name,
        slug: orgSlug,
        members: {
          create: {
            userId,
            role: 'OWNER',
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

    res.status(201).json({ organization });
  } catch (error) {
    console.error('Create organization error:', error);
    res.status(500).json({ error: 'Failed to create organization' });
  }
});

// GET /organizations/:id - Get single organization
router.get('/:id', requireOrgScope({ paramKey: 'id' }), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const organization = await prisma.organization.findFirst({
      where: {
        id,
        members: {
          some: {
            userId: req.scope!.userId,
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

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    res.json({ organization, role: req.scope!.role });
  } catch (error) {
    console.error('Get organization error:', error);
    res.status(500).json({ error: 'Failed to get organization' });
  }
});

// PATCH /organizations/:id - Update organization
router.patch('/:id', requireOrgScope({ paramKey: 'id' }), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!canManageOrganization(req.scope!.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const organization = await prisma.organization.update({
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

    res.json({ organization });
  } catch (error) {
    console.error('Update organization error:', error);
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

// DELETE /organizations/:id - Delete organization (OWNER only)
router.delete('/:id', requireOrgScope({ paramKey: 'id' }), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!canDeleteOrganization(req.scope!.role)) {
      return res.status(403).json({ error: 'Only owners can delete organizations' });
    }

    // Delete organization (cascades to members and projects)
    await prisma.organization.delete({
      where: { id },
    });

    res.json({ success: true, message: 'Organization deleted' });
  } catch (error) {
    console.error('Delete organization error:', error);
    res.status(500).json({ error: 'Failed to delete organization' });
  }
});

export default router;
