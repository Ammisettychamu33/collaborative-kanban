import { Router } from 'express';
import { getActivityLogs } from '../controllers/activityController.js';
import { authenticate } from '../middleware/auth.js';
import { requireTenant } from '../middleware/tenant.js';

const router = Router();

router.use(authenticate, requireTenant);

router.get('/', getActivityLogs);

export default router;
