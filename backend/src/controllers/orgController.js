import { z } from 'zod';
import { prisma } from '../database/db.js';
import { AppError } from '../middleware/errorHandler.js';

const orgSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters'),
});

export async function getOrganizations(req, res, next) {
  try {
    const memberships = await prisma.membership.findMany({
      where: { userId: req.user.id },
      include: {
        organization: {
          include: {
            tenants: true,
          },
        },
      },
    });

    const uniqueOrgs = [];
    const seen = new Set();

    for (const m of memberships) {
      if (!seen.has(m.organization.id)) {
        seen.add(m.organization.id);
        uniqueOrgs.push({
          id: m.organization.id,
          name: m.organization.name,
          role: m.role,
          createdAt: m.organization.createdAt,
          tenants: m.organization.tenants,
        });
      }
    }

    res.json(uniqueOrgs);
  } catch (err) {
    next(err);
  }
}

export async function createOrganization(req, res, next) {
  try {
    const data = orgSchema.parse(req.body);

    const org = await prisma.$transaction(async (tx) => {
      const newOrg = await tx.organization.create({
        data: { name: data.name.trim() },
      });

      // Default tenant
      const defaultTenant = await tx.tenant.create({
        data: {
          organizationId: newOrg.id,
          name: 'Primary Branch',
        },
      });

      // Creator is ORG_ADMIN
      await tx.membership.create({
        data: {
          userId: req.user.id,
          organizationId: newOrg.id,
          tenantId: defaultTenant.id,
          role: 'ORG_ADMIN',
        },
      });

      // Default board & columns
      const board = await tx.board.create({
        data: {
          organizationId: newOrg.id,
          tenantId: defaultTenant.id,
          name: 'General Project Board',
          description: 'Default board for Primary Branch',
          createdBy: req.user.id,
        },
      });

      await tx.column.createMany({
        data: [
          { boardId: board.id, tenantId: defaultTenant.id, name: 'To Do', position: 0 },
          { boardId: board.id, tenantId: defaultTenant.id, name: 'In Progress', position: 1 },
          { boardId: board.id, tenantId: defaultTenant.id, name: 'Testing', position: 2 },
          { boardId: board.id, tenantId: defaultTenant.id, name: 'Done', position: 3 },
        ],
      });

      return newOrg;
    });

    res.status(201).json(org);
  } catch (err) {
    next(err);
  }
}

export async function getOrganizationById(req, res, next) {
  try {
    const { id } = req.params;

    // Verify user has membership in this organization
    const membership = await prisma.membership.findFirst({
      where: {
        userId: req.user.id,
        organizationId: id,
      },
    });

    if (!membership) {
      throw new AppError('Organization not found or access denied', 404, 'ORG_NOT_FOUND');
    }

    const org = await prisma.organization.findUnique({
      where: { id },
      include: {
        tenants: true,
      },
    });

    res.json(org);
  } catch (err) {
    next(err);
  }
}

export async function updateOrganization(req, res, next) {
  try {
    const { id } = req.params;
    const data = orgSchema.parse(req.body);

    const membership = await prisma.membership.findFirst({
      where: {
        userId: req.user.id,
        organizationId: id,
        role: 'ORG_ADMIN',
      },
    });

    if (!membership) {
      throw new AppError('Only Organization Admins can modify organization settings', 403, 'FORBIDDEN');
    }

    const updated = await prisma.organization.update({
      where: { id },
      data: { name: data.name.trim() },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function deleteOrganization(req, res, next) {
  try {
    const { id } = req.params;

    const membership = await prisma.membership.findFirst({
      where: {
        userId: req.user.id,
        organizationId: id,
        role: 'ORG_ADMIN',
      },
    });

    if (!membership) {
      throw new AppError('Only Organization Admins can delete organizations', 403, 'FORBIDDEN');
    }

    await prisma.organization.delete({
      where: { id },
    });

    res.json({ message: 'Organization deleted successfully' });
  } catch (err) {
    next(err);
  }
}
