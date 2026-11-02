import { Router } from 'express';
import {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  moveTask,
  undoRedoTask,
  deleteTask,
} from '../controllers/taskController.js';
import { authenticate } from '../middleware/auth.js';
import { requireTenant } from '../middleware/tenant.js';

const router = Router();

router.use(authenticate, requireTenant);

router.get('/', getTasks);
router.post('/', createTask);
router.get('/:id', getTaskById);
router.put('/:id', updateTask);
router.patch('/:id/move', moveTask);
router.post('/:id/undo', undoRedoTask);
router.delete('/:id', deleteTask);

export default router;
