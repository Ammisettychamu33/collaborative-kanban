import { z } from 'zod';
import { prisma } from '../database/db.js';
import { AppError } from '../middleware/errorHandler.js';

const tenantSchema = z.object({
  name: z.string().min(2, 'Tenant name must be at least 2 characters'),
  organizationId: z.string().uuid('Valid organization ID is required'),
});

const memberSchema = z.object({
  email: z.string().email('Valid user email required'),
  role: z.enum(['TENANT_ADMIN', 'MEMBER']).default('MEMBER'),
});

export async function getTenants(req, res, next) {
  try {
    const orgId = req.query.organizationId || req.organizationId;
    let whereClause = {};

    if (orgId) {
      // Verify access to org
      const hasOrgAccess = req.memberships.some((m) => m.organizationId === orgId);
      if (!hasOrgAccess) {
        throw new AppError('Access denied to specified organization', 403, 'FORBIDDEN');
      }
      whereClause.organizationId = orgId;
    } else {
      // Filter by organizations where user is a member
      const userOrgIds = req.memberships.map((m) => m.organizationId);
      whereClause.organizationId = { in: userOrgIds };
    }

    const tenants = await prisma.tenant.findMany({
      where: whereClause,
      include: {
        organization: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });

    res.json(tenants);
  } catch (err) {
    next(err);
  }
}

export async function createTenant(req, res, next) {
  try {
    const data = tenantSchema.parse(req.body);

    // Verify user is ORG_ADMIN of this organization
    const orgMembership = req.memberships.find(
      (m) => m.organizationId === data.organizationId && m.role === 'ORG_ADMIN'
    );

    if (!orgMembership) {
      throw new AppError('Only Organization Admins can create new tenants/branches', 403, 'FORBIDDEN');
    }

    const tenant = await prisma.$transaction(async (tx) => {
      const newTenant = await tx.tenant.create({
        data: {
          organizationId: data.organizationId,
          name: data.name.trim(),
        },
      });

      // Assign creator as TENANT_ADMIN also
      await tx.membership.create({
        data: {
          userId: req.user.id,
          organizationId: data.organizationId,
          tenantId: newTenant.id,
          role: 'TENANT_ADMIN',
        },
      });

      // Create default board and columns
      const board = await tx.board.create({
        data: {
          organizationId: data.organizationId,
          tenantId: newTenant.id,
          name: `${data.name} Operations Board`,
          description: `Initial project board for ${data.name}`,
          createdBy: req.user.id,
        },
      });

      await tx.column.createMany({
        data: [
          { boardId: board.id, tenantId: newTenant.id, name: 'To Do', position: 0 },
          { boardId: board.id, tenantId: newTenant.id, name: 'In Progress', position: 1 },
          { boardId: board.id, tenantId: newTenant.id, name: 'Testing', position: 2 },
          { boardId: board.id, tenantId: newTenant.id, name: 'Done', position: 3 },
        ],
      });

      return newTenant;
    });

    res.status(201).json(tenant);
  } catch (err) {
    next(err);
  }
}

export async function getTenantById(req, res, next) {
  try {
    const { id } = req.params;

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        organization: true,
        boards: {
          select: { id: true, name: true, description: true, createdAt: true },
        },
      },
    });

    if (!tenant) {
      throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');
    }

    // Verify authorization
    const isDirectMember = req.memberships.some((m) => m.tenantId === tenant.id);
    const isOrgAdmin = req.memberships.some(
      (m) => m.organizationId === tenant.organizationId && m.role === 'ORG_ADMIN'
    );

    if (!isDirectMember && !isOrgAdmin) {
      throw new AppError('Tenant not found or access denied', 404, 'TENANT_NOT_FOUND');
    }

    res.json(tenant);
  } catch (err) {
    next(err);
  }
}

export async function getTenantMembers(req, res, next) {
  try {
    const tenantId = req.params.id || req.tenantId;

    const memberships = await prisma.membership.findMany({
      where: { tenantId },
      include: {
        user: {
          select: { id: true, name: true, email: true, createdAt: true },
        },
      },
    });

    const members = memberships.map((m) => ({
      id: m.id,
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      joinedAt: m.createdAt,
    }));

    res.json(members);
  } catch (err) {
    next(err);
  }
}

export async function addTenantMember(req, res, next) {
  try {
    const tenantId = req.params.id || req.tenantId;
    const data = memberSchema.parse(req.body);

    // Verify requesting user is ORG_ADMIN or TENANT_ADMIN
    const canManage =
      req.activeRole === 'ORG_ADMIN' || req.activeRole === 'TENANT_ADMIN';
    if (!canManage) {
      throw new AppError('Only Admins can add members to this tenant', 403, 'FORBIDDEN');
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');

    // Find user by email
    const targetUser = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase().trim() },
    });

    if (!targetUser) {
      throw new AppError('No user found with the provided email address', 404, 'USER_NOT_FOUND');
    }

    // Check if membership already exists
    const existingMembership = await prisma.membership.findFirst({
      where: {
        userId: targetUser.id,
        tenantId,
      },
    });

    if (existingMembership) {
      throw new AppError('User is already a member of this tenant', 409, 'ALREADY_MEMBER');
    }

    const membership = await prisma.membership.create({
      data: {
        userId: targetUser.id,
        organizationId: tenant.organizationId,
        tenantId,
        role: data.role,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    res.status(201).json({
      message: 'Member added successfully',
      member: {
        id: membership.id,
        userId: membership.user.id,
        name: membership.user.name,
        email: membership.user.email,
        role: membership.role,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function removeTenantMember(req, res, next) {
  try {
    const { id: tenantId, memberId } = req.params;

    const canManage =
      req.activeRole === 'ORG_ADMIN' || req.activeRole === 'TENANT_ADMIN';
    if (!canManage) {
      throw new AppError('Only Admins can remove members', 403, 'FORBIDDEN');
    }

    await prisma.membership.delete({
      where: { id: memberId },
    });

    res.json({ message: 'Member removed successfully' });
  } catch (err) {
    next(err);
  }
}
