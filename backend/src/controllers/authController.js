import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../database/db.js';
import config from '../config/index.js';
import { AppError } from '../middleware/errorHandler.js';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  organizationName: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

function generateToken(userId) {
  return jwt.sign({ userId }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

export async function register(req, res, next) {
  try {
    const data = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase().trim() },
    });

    if (existingUser) {
      throw new AppError('An account with this email already exists', 409, 'EMAIL_EXISTS');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    // Create user and optionally default organization & tenant
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: data.name.trim(),
          email: data.email.toLowerCase().trim(),
          passwordHash,
        },
      });

      const orgName = data.organizationName?.trim() || `${data.name}'s Organization`;
      const org = await tx.organization.create({
        data: { name: orgName },
      });

      const defaultTenant = await tx.tenant.create({
        data: {
          organizationId: org.id,
          name: 'Main Branch',
        },
      });

      // Grant ORG_ADMIN at org level and TENANT_ADMIN at tenant level
      await tx.membership.create({
        data: {
          userId: newUser.id,
          organizationId: org.id,
          tenantId: defaultTenant.id,
          role: 'ORG_ADMIN',
        },
      });

      // Default board
      const board = await tx.board.create({
        data: {
          organizationId: org.id,
          tenantId: defaultTenant.id,
          name: 'Welcome Board',
          description: 'Default project board for your workspace',
          createdBy: newUser.id,
        },
      });

      // Default columns
      await tx.column.createMany({
        data: [
          { boardId: board.id, tenantId: defaultTenant.id, name: 'To Do', position: 0 },
          { boardId: board.id, tenantId: defaultTenant.id, name: 'In Progress', position: 1 },
          { boardId: board.id, tenantId: defaultTenant.id, name: 'Testing', position: 2 },
          { boardId: board.id, tenantId: defaultTenant.id, name: 'Done', position: 3 },
        ],
      });

      return newUser;
    });

    const token = generateToken(user.id);

    res.status(201).json({
      message: 'Account created successfully',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase().trim() },
      include: {
        memberships: {
          include: {
            organization: true,
            tenant: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const isMatch = await bcrypt.compare(data.password, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const token = generateToken(user.id);

    // Group organizations and tenants available to the user
    const organizationsMap = new Map();
    for (const m of user.memberships) {
      if (!organizationsMap.has(m.organization.id)) {
        organizationsMap.set(m.organization.id, {
          id: m.organization.id,
          name: m.organization.name,
          role: m.role,
          tenants: [],
        });
      }
      if (m.tenant) {
        organizationsMap.get(m.organization.id).tenants.push({
          id: m.tenant.id,
          name: m.tenant.name,
          role: m.role,
        });
      }
    }

    // For Org Admins, fetch all tenants of the organization
    for (const [orgId, orgData] of organizationsMap.entries()) {
      if (orgData.role === 'ORG_ADMIN') {
        const allOrgTenants = await prisma.tenant.findMany({
          where: { organizationId: orgId },
        });
        const existingTenantIds = new Set(orgData.tenants.map((t) => t.id));
        for (const t of allOrgTenants) {
          if (!existingTenantIds.has(t.id)) {
            orgData.tenants.push({
              id: t.id,
              name: t.name,
              role: 'ORG_ADMIN',
            });
          }
        }
      }
    }

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      organizations: Array.from(organizationsMap.values()),
    });
  } catch (err) {
    next(err);
  }
}

export async function getCurrentUser(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        memberships: {
          include: {
            organization: true,
            tenant: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const organizationsMap = new Map();
    for (const m of user.memberships) {
      if (!organizationsMap.has(m.organization.id)) {
        organizationsMap.set(m.organization.id, {
          id: m.organization.id,
          name: m.organization.name,
          role: m.role,
          tenants: [],
        });
      }
      if (m.tenant) {
        organizationsMap.get(m.organization.id).tenants.push({
          id: m.tenant.id,
          name: m.tenant.name,
          role: m.role,
        });
      }
    }

    // Include all tenants for Org Admins
    for (const [orgId, orgData] of organizationsMap.entries()) {
      if (orgData.role === 'ORG_ADMIN') {
        const allOrgTenants = await prisma.tenant.findMany({
          where: { organizationId: orgId },
        });
        const existingTenantIds = new Set(orgData.tenants.map((t) => t.id));
        for (const t of allOrgTenants) {
          if (!existingTenantIds.has(t.id)) {
            orgData.tenants.push({
              id: t.id,
              name: t.name,
              role: 'ORG_ADMIN',
            });
          }
        }
      }
    }

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      organizations: Array.from(organizationsMap.values()),
    });
  } catch (err) {
    next(err);
  }
}

export function logout(req, res) {
  res.json({ message: 'Logged out successfully' });
}
