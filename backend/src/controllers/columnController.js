import { z } from 'zod';
import { prisma } from '../database/db.js';
import { AppError } from '../middleware/errorHandler.js';
import { broadcastToTenant } from '../services/socketService.js';

const columnSchema = z.object({
  name: z.string().min(1, 'Column name is required'),
  position: z.number().int().optional(),
});

export async function getColumns(req, res, next) {
  try {
    const { boardId } = req.params;

    // Verify board belongs to active tenant
    const board = await prisma.board.findFirst({
      where: { id: boardId, tenantId: req.tenantId },
    });

    if (!board) {
      throw new AppError('Board not found or inaccessible', 404, 'BOARD_NOT_FOUND');
    }

    const columns = await prisma.column.findMany({
      where: { boardId, tenantId: req.tenantId },
      orderBy: { position: 'asc' },
    });

    res.json(columns);
  } catch (err) {
    next(err);
  }
}

export async function createColumn(req, res, next) {
  try {
    const { boardId } = req.params;
    const data = columnSchema.parse(req.body);

    if (req.activeRole === 'MEMBER') {
      throw new AppError('Only Admins can add columns', 403, 'FORBIDDEN');
    }

    const board = await prisma.board.findFirst({
      where: { id: boardId, tenantId: req.tenantId },
    });

    if (!board) {
      throw new AppError('Board not found or inaccessible', 404, 'BOARD_NOT_FOUND');
    }

    // Determine position
    let position = data.position;
    if (position === undefined) {
      const maxCol = await prisma.column.findFirst({
        where: { boardId, tenantId: req.tenantId },
        orderBy: { position: 'desc' },
      });
      position = maxCol ? maxCol.position + 1 : 0;
    }

    const column = await prisma.column.create({
      data: {
        boardId,
        tenantId: req.tenantId,
        name: data.name.trim(),
        position,
      },
    });

    await prisma.activityLog.create({
      data: {
        tenantId: req.tenantId,
        userId: req.user.id,
        entityType: 'COLUMN',
        entityId: column.id,
        action: 'CREATED',
        details: { boardId, name: column.name, position },
      },
    });

    broadcastToTenant(req.tenantId, 'column:created', column);
    res.status(201).json(column);
  } catch (err) {
    next(err);
  }
}

export async function updateColumn(req, res, next) {
  try {
    const { id } = req.params;
    const data = columnSchema.parse(req.body);

    if (req.activeRole === 'MEMBER') {
      throw new AppError('Only Admins can modify columns', 403, 'FORBIDDEN');
    }

    const existing = await prisma.column.findFirst({
      where: { id, tenantId: req.tenantId },
    });

    if (!existing) {
      throw new AppError('Column not found or inaccessible', 404, 'COLUMN_NOT_FOUND');
    }

    const updated = await prisma.column.update({
      where: { id },
      data: {
        name: data.name !== undefined ? data.name.trim() : existing.name,
        position: data.position !== undefined ? data.position : existing.position,
      },
    });

    broadcastToTenant(req.tenantId, 'column:updated', updated);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function deleteColumn(req, res, next) {
  try {
    const { id } = req.params;

    if (req.activeRole === 'MEMBER') {
      throw new AppError('Only Admins can delete columns', 403, 'FORBIDDEN');
    }

    const existing = await prisma.column.findFirst({
      where: { id, tenantId: req.tenantId },
    });

    if (!existing) {
      throw new AppError('Column not found or inaccessible', 404, 'COLUMN_NOT_FOUND');
    }

    await prisma.column.delete({
      where: { id },
    });

    await prisma.activityLog.create({
      data: {
        tenantId: req.tenantId,
        userId: req.user.id,
        entityType: 'COLUMN',
        entityId: id,
        action: 'DELETED',
        details: { name: existing.name },
      },
    });

    broadcastToTenant(req.tenantId, 'column:deleted', { id, boardId: existing.boardId });
    res.json({ message: 'Column deleted successfully' });
  } catch (err) {
    next(err);
  }
}
