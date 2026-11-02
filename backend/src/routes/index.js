import { Router } from 'express';
import authRoutes from './authRoutes.js';
import orgRoutes from './orgRoutes.js';
import tenantRoutes from './tenantRoutes.js';
import boardRoutes from './boardRoutes.js';
import columnRoutes from './columnRoutes.js';
import taskRoutes from './taskRoutes.js';
import activityRoutes from './activityRoutes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/organizations', orgRoutes);
router.use('/tenants', tenantRoutes);
router.use('/boards', boardRoutes);
router.use('/columns', columnRoutes);
router.use('/tasks', taskRoutes);
router.use('/activity', activityRoutes);

export default router;
