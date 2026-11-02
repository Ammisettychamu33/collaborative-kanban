import { prisma } from '../database/db.js';
import { AppError } from './errorHandler.js';

export async function requireTenant(req, res, next) {
  try {
    const rawTenantId = 
      req.headers['x-tenant-id'] || 
      req.params.tenantId || 
      req.query.tenantId || 
      req.body?.tenantId;

    if (!rawTenantId) {
      throw new AppError('Tenant context required. Provide x-tenant-id header.', 400, 'TENANT_HEADER_REQUIRED');
    }

    const tenantId = String(rawTenantId).trim();

    // Fetch tenant from database
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { organization: true },
    });

    if (!tenant) {
      throw new AppError('Tenant not found or inaccessible', 404, 'TENANT_NOT_FOUND');
    }

    // Check user memberships for access
    const memberships = req.memberships || [];
    
    // Check direct tenant membership
    const directMembership = memberships.find((m) => m.tenantId === tenant.id);
    
    // Check organization-level admin membership
    const orgAdminMembership = memberships.find(
      (m) => m.organizationId === tenant.organizationId && m.role === 'ORG_ADMIN'
    );

    if (!directMembership && !orgAdminMembership) {
      throw new AppError('Access denied: You are not a member of this tenant or organization.', 403, 'FORBIDDEN_TENANT_ACCESS');
    }

    // Determine active role for this tenant context
    const activeRole = directMembership ? directMembership.role : 'ORG_ADMIN';

    // Attach verified tenant context to request
    req.tenant = tenant;
    req.tenantId = tenant.id;
    req.organizationId = tenant.organizationId;
    req.activeRole = activeRole;
    req.activeMembership = directMembership || orgAdminMembership;

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Role-Based Access Control middleware
 * @param {Array<string>} allowedRoles e.g. ['ORG_ADMIN', 'TENANT_ADMIN']
 */
export function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.activeRole) {
      return next(new AppError('Tenant context required to check roles', 403, 'TENANT_CONTEXT_REQUIRED'));
    }

    if (!allowedRoles.includes(req.activeRole)) {
      return next(
        new AppError(
          `Action requires one of the following roles: ${allowedRoles.join(', ')}. Current role: ${req.activeRole}`,
          403,
          'INSUFFICIENT_PERMISSIONS'
        )
      );
    }

    next();
  };
}

/**
 * Validates that an existing entity belongs to the active tenant.
 * Non-disclosing: returns 404 if entity is null or tenant mismatch.
 */
export function assertTenantOwnership(entity, tenantId, entityName = 'Resource') {
  if (!entity || entity.tenantId !== tenantId) {
    throw new AppError(`${entityName} not found or inaccessible`, 404, 'RESOURCE_NOT_FOUND');
  }
}
