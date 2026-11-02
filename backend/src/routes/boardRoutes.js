import { Router } from 'express';
import {
  getBoards,
  createBoard,
  getBoardById,
  updateBoard,
  deleteBoard,
} from '../controllers/boardController.js';
import { getColumns, createColumn } from '../controllers/columnController.js';
import { authenticate } from '../middleware/auth.js';
import { requireTenant } from '../middleware/tenant.js';

const router = Router();

router.use(authenticate, requireTenant);

router.get('/', getBoards);
router.post('/', createBoard);
router.get('/:id', getBoardById);
router.put('/:id', updateBoard);
router.delete('/:id', deleteBoard);

// Nested column routes
router.get('/:boardId/columns', getColumns);
router.post('/:boardId/columns', createColumn);

export default router;
