import { z } from 'zod';
import { prisma } from '../database/db.js';
import { AppError } from '../middleware/errorHandler.js';
import { broadcastToTenant } from '../services/socketService.js';

const boardSchema = z.object({
  name: z.string().min(2, 'Board name must be at least 2 characters'),
  description: z.string().optional(),
});

export async function getBoards(req, res, next) {
  try {
    const boards = await prisma.board.findMany({
      where: { tenantId: req.tenantId },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        _count: { select: { tasks: true, columns: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(boards);
  } catch (err) {
    next(err);
  }
}

export async function createBoard(req, res, next) {
  try {
    const data = boardSchema.parse(req.body);

    const isMember = req.activeRole === 'MEMBER';
    if (isMember) {
      throw new AppError('Only Admins can create new boards', 403, 'FORBIDDEN');
    }

    const board = await prisma.$transaction(async (tx) => {
      const newBoard = await tx.board.create({
        data: {
          organizationId: req.organizationId,
          tenantId: req.tenantId,
          name: data.name.trim(),
          description: data.description?.trim() || null,
          createdBy: req.user.id,
        },
      });

      // Default 4 columns
      const defaultCols = [
        { boardId: newBoard.id, tenantId: req.tenantId, name: 'To Do', position: 0 },
        { boardId: newBoard.id, tenantId: req.tenantId, name: 'In Progress', position: 1 },
        { boardId: newBoard.id, tenantId: req.tenantId, name: 'Testing', position: 2 },
        { boardId: newBoard.id, tenantId: req.tenantId, name: 'Done', position: 3 },
      ];

      await tx.column.createMany({ data: defaultCols });

      // Activity log
      await tx.activityLog.create({
        data: {
          tenantId: req.tenantId,
          userId: req.user.id,
          entityType: 'BOARD',
          entityId: newBoard.id,
          action: 'CREATED',
          details: { name: newBoard.name },
        },
      });

      return newBoard;
    });

    broadcastToTenant(req.tenantId, 'board:created', board);
    res.status(201).json(board);
  } catch (err) {
    next(err);
  }
}

export async function getBoardById(req, res, next) {
  try {
    const { id } = req.params;

    const board = await prisma.board.findFirst({
      where: {
        id,
        tenantId: req.tenantId, // Strict tenant isolation!
      },
      include: {
        columns: {
          orderBy: { position: 'asc' },
          include: {
            tasks: {
              where: { tenantId: req.tenantId },
              orderBy: { position: 'asc' },
              include: {
                assignee: { select: { id: true, name: true, email: true } },
                creator: { select: { id: true, name: true, email: true } },
              },
            },
          },
        },
      },
    });

    if (!board) {
      throw new AppError('Board not found or inaccessible in this tenant', 404, 'BOARD_NOT_FOUND');
    }

    res.json(board);
  } catch (err) {
    next(err);
  }
}

export async function updateBoard(req, res, next) {
  try {
    const { id } = req.params;
    const data = boardSchema.parse(req.body);

    if (req.activeRole === 'MEMBER') {
      throw new AppError('Only Admins can update board settings', 403, 'FORBIDDEN');
    }

    // Verify board belongs to active tenant
    const existing = await prisma.board.findFirst({
      where: { id, tenantId: req.tenantId },
    });

    if (!existing) {
      throw new AppError('Board not found or inaccessible', 404, 'BOARD_NOT_FOUND');
    }

    const updated = await prisma.board.update({
      where: { id },
      data: {
        name: data.name.trim(),
        description: data.description?.trim() || null,
      },
    });

    await prisma.activityLog.create({
      data: {
        tenantId: req.tenantId,
        userId: req.user.id,
        entityType: 'BOARD',
        entityId: id,
        action: 'UPDATED',
        details: { name: updated.name },
      },
    });

    broadcastToTenant(req.tenantId, 'board:updated', updated);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function deleteBoard(req, res, next) {
  try {
    const { id } = req.params;

    if (req.activeRole === 'MEMBER') {
      throw new AppError('Only Admins can delete boards', 403, 'FORBIDDEN');
    }

    const existing = await prisma.board.findFirst({
      where: { id, tenantId: req.tenantId },
    });

    if (!existing) {
      throw new AppError('Board not found or inaccessible', 404, 'BOARD_NOT_FOUND');
    }

    await prisma.board.delete({
      where: { id },
    });

    await prisma.activityLog.create({
      data: {
        tenantId: req.tenantId,
        userId: req.user.id,
        entityType: 'BOARD',
        entityId: id,
        action: 'DELETED',
        details: { name: existing.name },
      },
    });

    broadcastToTenant(req.tenantId, 'board:deleted', { id });
    res.json({ message: 'Board deleted successfully' });
  } catch (err) {
    next(err);
  }
}
