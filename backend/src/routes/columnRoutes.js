import { Router } from 'express';
import { updateColumn, deleteColumn } from '../controllers/columnController.js';
import { authenticate } from '../middleware/auth.js';
import { requireTenant } from '../middleware/tenant.js';

const router = Router();

router.use(authenticate, requireTenant);

router.put('/:id', updateColumn);
router.delete('/:id', deleteColumn);

export default router;
