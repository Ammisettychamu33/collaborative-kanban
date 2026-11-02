import { Router } from 'express';
import {
  getTenants,
  createTenant,
  getTenantById,
  getTenantMembers,
  addTenantMember,
  removeTenantMember,
} from '../controllers/tenantController.js';
import { authenticate } from '../middleware/auth.js';
import { requireTenant } from '../middleware/tenant.js';

const router = Router();

router.use(authenticate);

router.get('/', getTenants);
router.post('/', createTenant);
router.get('/:id', getTenantById);

// Tenant member management
router.get('/:id/members', requireTenant, getTenantMembers);
router.post('/:id/members', requireTenant, addTenantMember);
router.delete('/:id/members/:memberId', requireTenant, removeTenantMember);

export default router;
