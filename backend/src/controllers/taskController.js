import { z } from 'zod';
import { prisma } from '../database/db.js';
import { AppError } from '../middleware/errorHandler.js';
import { broadcastToTenant } from '../services/socketService.js';

const createTaskSchema = z.object({
  boardId: z.string().uuid('Valid board ID is required'),
  columnId: z.string().uuid('Valid column ID is required'),
  title: z.string().min(1, 'Task title is required').max(255),
  description: z.string().optional().nullable(),
  assignedTo: z.string().uuid().optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  dueDate: z.string().datetime().optional().nullable(),
  position: z.number().int().optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  assignedTo: z.string().uuid().optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  dueDate: z.string().datetime().optional().nullable(),
  version: z.number().int({ message: 'Task version is required for concurrency control' }),
});

const moveTaskSchema = z.object({
  columnId: z.string().uuid('Valid destination column ID is required'),
  position: z.number().int().min(0, 'Position must be 0 or greater'),
  version: z.number().int({ message: 'Task version is required for concurrency control' }),
});

const undoSchema = z.object({
  columnId: z.string().uuid().optional(),
  position: z.number().int().min(0).optional(),
  title: z.string().optional(),
  description: z.string().optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assignedTo: z.string().uuid().optional().nullable(),
  version: z.number().int({ message: 'Current task version is required' }),
});

export async function getTasks(req, res, next) {
  try {
    const { boardId, columnId } = req.query;
    const whereClause = { tenantId: req.tenantId };

    if (boardId) whereClause.boardId = boardId;
    if (columnId) whereClause.columnId = columnId;

    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true, email: true } },
      },
      orderBy: { position: 'asc' },
    });

    res.json(tasks);
  } catch (err) {
    next(err);
  }
}

export async function getTaskById(req, res, next) {
  try {
    const { id } = req.params;

    const task = await prisma.task.findFirst({
      where: { id, tenantId: req.tenantId },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true, email: true } },
        column: { select: { id: true, name: true, position: true } },
        board: { select: { id: true, name: true } },
      },
    });

    if (!task) {
      throw new AppError('Task not found or inaccessible in this tenant', 404, 'TASK_NOT_FOUND');
    }

    // Fetch related activity logs for this task
    const activityLogs = await prisma.activityLog.findMany({
      where: {
        tenantId: req.tenantId,
        entityType: 'TASK',
        entityId: id,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    res.json({ ...task, activityLogs });
  } catch (err) {
    next(err);
  }
}

export async function createTask(req, res, next) {
  try {
    const data = createTaskSchema.parse(req.body);

    // 1. Strict Tenant & Board Consistency Check
    const column = await prisma.column.findFirst({
      where: {
        id: data.columnId,
        boardId: data.boardId,
        tenantId: req.tenantId,
      },
    });

    if (!column) {
      throw new AppError(
        'Column does not exist or does not belong to the active board and tenant',
        400,
        'INVALID_COLUMN_TENANT_RELATION'
      );
    }

    // 2. Validate Assignee is a member of this tenant
    if (data.assignedTo) {
      const isAssigneeMember = await prisma.membership.findFirst({
        where: {
          userId: data.assignedTo,
          tenantId: req.tenantId,
        },
      });

      if (!isAssigneeMember) {
        throw new AppError(
          'Cannot assign task to a user who is not a member of this tenant',
          400,
          'INVALID_ASSIGNEE'
        );
      }
    }

    // 3. Determine Position
    let position = data.position;
    if (position === undefined) {
      const maxTask = await prisma.task.findFirst({
        where: { columnId: data.columnId, tenantId: req.tenantId },
        orderBy: { position: 'desc' },
      });
      position = maxTask ? maxTask.position + 1 : 0;
    }

    // 4. Create Task Transactionally with Activity Log
    const task = await prisma.$transaction(async (tx) => {
      const newTask = await tx.task.create({
        data: {
          boardId: data.boardId,
          columnId: data.columnId,
          tenantId: req.tenantId,
          title: data.title.trim(),
          description: data.description?.trim() || null,
          assignedTo: data.assignedTo || null,
          priority: data.priority,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          position,
          version: 1,
          createdBy: req.user.id,
        },
        include: {
          assignee: { select: { id: true, name: true, email: true } },
          creator: { select: { id: true, name: true, email: true } },
        },
      });

      await tx.activityLog.create({
        data: {
          tenantId: req.tenantId,
          userId: req.user.id,
          entityType: 'TASK',
          entityId: newTask.id,
          action: 'CREATED',
          details: {
            title: newTask.title,
            columnId: newTask.columnId,
            priority: newTask.priority,
          },
        },
      });

      return newTask;
    });

    broadcastToTenant(req.tenantId, 'task:created', task);
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
}

export async function updateTask(req, res, next) {
  try {
    const { id } = req.params;
    const data = updateTaskSchema.parse(req.body);

    // Fetch existing task
    const existing = await prisma.task.findFirst({
      where: { id, tenantId: req.tenantId },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
      },
    });

    if (!existing) {
      throw new AppError('Task not found or inaccessible', 404, 'TASK_NOT_FOUND');
    }

    // Optimistic Concurrency Check
    if (existing.version !== data.version) {
      return res.status(409).json({
        error: 'Conflict: This task was modified by another user.',
        code: 'CONCURRENCY_CONFLICT',
        currentVersion: existing.version,
        task: existing,
      });
    }

    // Validate Assignee if changed
    if (data.assignedTo && data.assignedTo !== existing.assignedTo) {
      const isMember = await prisma.membership.findFirst({
        where: { userId: data.assignedTo, tenantId: req.tenantId },
      });
      if (!isMember) {
        throw new AppError('Assignee must be a member of this tenant', 400, 'INVALID_ASSIGNEE');
      }
    }

    // Atomic conditional update with version increment
    const updateResult = await prisma.task.updateMany({
      where: {
        id,
        version: data.version,
        tenantId: req.tenantId,
      },
      data: {
        ...(data.title !== undefined && { title: data.title.trim() }),
        ...(data.description !== undefined && { description: data.description?.trim() || null }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.assignedTo !== undefined && { assignedTo: data.assignedTo }),
        ...(data.dueDate !== undefined && { dueDate: data.dueDate ? new Date(data.dueDate) : null }),
        version: data.version + 1,
      },
    });

    if (updateResult.count === 0) {
      const latest = await prisma.task.findFirst({
        where: { id, tenantId: req.tenantId },
        include: {
          assignee: { select: { id: true, name: true, email: true } },
        },
      });
      return res.status(409).json({
        error: 'Conflict: This task was modified by another user.',
        code: 'CONCURRENCY_CONFLICT',
        currentVersion: latest ? latest.version : null,
        task: latest,
      });
    }

    const refreshed = await prisma.task.findFirst({
      where: { id },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true, email: true } },
      },
    });

    await prisma.activityLog.create({
      data: {
        tenantId: req.tenantId,
        userId: req.user.id,
        entityType: 'TASK',
        entityId: id,
        action: 'UPDATED',
        details: {
          previousVersion: data.version,
          newVersion: refreshed.version,
          changes: {
            title: data.title,
            priority: data.priority,
            assignedTo: data.assignedTo,
          },
        },
      },
    });

    broadcastToTenant(req.tenantId, 'task:updated', refreshed);
    res.json(refreshed);
  } catch (err) {
    next(err);
  }
}

export async function moveTask(req, res, next) {
  try {
    const { id } = req.params;
    const { columnId: destColumnId, position: targetPos, version } = moveTaskSchema.parse(req.body);

    const existing = await prisma.task.findFirst({
      where: { id, tenantId: req.tenantId },
    });

    if (!existing) {
      throw new AppError('Task not found or inaccessible', 404, 'TASK_NOT_FOUND');
    }

    // Optimistic Concurrency Check
    if (existing.version !== version) {
      return res.status(409).json({
        error: 'Conflict: This task was moved or updated by another user.',
        code: 'CONCURRENCY_CONFLICT',
        currentVersion: existing.version,
        task: existing,
      });
    }

    // Validate destination column belongs to same tenant & board
    const destColumn = await prisma.column.findFirst({
      where: {
        id: destColumnId,
        boardId: existing.boardId,
        tenantId: req.tenantId,
      },
    });

    if (!destColumn) {
      throw new AppError(
        'Destination column does not exist or belongs to another board/tenant',
        400,
        'INVALID_DESTINATION_COLUMN'
      );
    }

    const sourceColId = existing.columnId;
    const isSameColumn = sourceColId === destColumnId;

    // Transactional Reordering
    const moved = await prisma.$transaction(async (tx) => {
      if (isSameColumn) {
        // Reordering within the same column
        if (targetPos > existing.position) {
          await tx.$executeRaw`
            UPDATE tasks 
            SET position = position - 1 
            WHERE column_id = ${sourceColId} 
              AND tenant_id = ${req.tenantId} 
              AND position > ${existing.position} 
              AND position <= ${targetPos};
          `;
        } else if (targetPos < existing.position) {
          await tx.$executeRaw`
            UPDATE tasks 
            SET position = position + 1 
            WHERE column_id = ${sourceColId} 
              AND tenant_id = ${req.tenantId} 
              AND position >= ${targetPos} 
              AND position < ${existing.position};
          `;
        }
      } else {
        // Moving across columns
        // 1. Close gap in source column
        await tx.$executeRaw`
          UPDATE tasks 
          SET position = position - 1 
          WHERE column_id = ${sourceColId} 
            AND tenant_id = ${req.tenantId} 
            AND position > ${existing.position};
        `;

        // 2. Open space in destination column
        await tx.$executeRaw`
          UPDATE tasks 
          SET position = position + 1 
          WHERE column_id = ${destColumnId} 
            AND tenant_id = ${req.tenantId} 
            AND position >= ${targetPos};
        `;
      }

      // Update the moved task atomically
      const moveResult = await tx.task.updateMany({
        where: { id, version, tenantId: req.tenantId },
        data: {
          columnId: destColumnId,
          position: targetPos,
          version: version + 1,
        },
      });

      if (moveResult.count === 0) {
        const latest = await tx.task.findFirst({ where: { id, tenantId: req.tenantId } });
        throw new AppError(
          'Conflict: This task was moved or updated by another user.',
          409,
          'CONCURRENCY_CONFLICT',
          latest
        );
      }

      const updatedTask = await tx.task.findFirst({
        where: { id },
        include: {
          assignee: { select: { id: true, name: true, email: true } },
          creator: { select: { id: true, name: true, email: true } },
        },
      });

      await tx.activityLog.create({
        data: {
          tenantId: req.tenantId,
          userId: req.user.id,
          entityType: 'TASK',
          entityId: id,
          action: 'MOVED',
          details: {
            fromColumnId: sourceColId,
            toColumnId: destColumnId,
            fromPosition: existing.position,
            toPosition: targetPos,
            previousVersion: existing.version,
            newVersion: updatedTask.version,
          },
        },
      });

      return updatedTask;
    });

    broadcastToTenant(req.tenantId, 'task:moved', {
      task: moved,
      fromColumnId: sourceColId,
      toColumnId: destColumnId,
      fromPosition: existing.position,
      toPosition: targetPos,
    });

    res.json(moved);
  } catch (err) {
    next(err);
  }
}

export async function undoRedoTask(req, res, next) {
  try {
    const { id } = req.params;
    const data = undoSchema.parse(req.body);

    const existing = await prisma.task.findFirst({
      where: { id, tenantId: req.tenantId },
    });

    if (!existing) {
      throw new AppError('Task not found or inaccessible', 404, 'TASK_NOT_FOUND');
    }

    if (existing.version !== data.version) {
      return res.status(409).json({
        error: 'Cannot apply undo: Task was modified by another concurrent action.',
        code: 'UNDO_CONFLICT',
        currentVersion: existing.version,
        task: existing,
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      // If moving columns during undo
      if (data.columnId && data.columnId !== existing.columnId) {
        await tx.$executeRaw`
          UPDATE tasks 
          SET position = position - 1 
          WHERE column_id = ${existing.columnId} 
            AND tenant_id = ${req.tenantId} 
            AND position > ${existing.position};
        `;

        const targetPos = data.position ?? 0;
        await tx.$executeRaw`
          UPDATE tasks 
          SET position = position + 1 
          WHERE column_id = ${data.columnId} 
            AND tenant_id = ${req.tenantId} 
            AND position >= ${targetPos};
        `;
      }

      const restored = await tx.task.update({
        where: { id },
        data: {
          ...(data.columnId && { columnId: data.columnId }),
          ...(data.position !== undefined && { position: data.position }),
          ...(data.title && { title: data.title.trim() }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.priority && { priority: data.priority }),
          ...(data.assignedTo !== undefined && { assignedTo: data.assignedTo }),
          version: existing.version + 1,
        },
        include: {
          assignee: { select: { id: true, name: true, email: true } },
          creator: { select: { id: true, name: true, email: true } },
        },
      });

      await tx.activityLog.create({
        data: {
          tenantId: req.tenantId,
          userId: req.user.id,
          entityType: 'TASK',
          entityId: id,
          action: 'UNDO_APPLIED',
          details: {
            restoredState: data,
            previousVersion: existing.version,
            newVersion: restored.version,
          },
        },
      });

      return restored;
    });

    broadcastToTenant(req.tenantId, 'task:updated', updated);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function deleteTask(req, res, next) {
  try {
    const { id } = req.params;

    const existing = await prisma.task.findFirst({
      where: { id, tenantId: req.tenantId },
    });

    if (!existing) {
      throw new AppError('Task not found or inaccessible', 404, 'TASK_NOT_FOUND');
    }

    await prisma.$transaction(async (tx) => {
      // Reorder remaining tasks in column
      await tx.$executeRaw`
        UPDATE tasks 
        SET position = position - 1 
        WHERE column_id = ${existing.columnId} 
          AND tenant_id = ${req.tenantId} 
          AND position > ${existing.position};
      `;

      await tx.task.delete({ where: { id } });

      await tx.activityLog.create({
        data: {
          tenantId: req.tenantId,
          userId: req.user.id,
          entityType: 'TASK',
          entityId: id,
          action: 'DELETED',
          details: { title: existing.title, columnId: existing.columnId },
        },
      });
    });

    broadcastToTenant(req.tenantId, 'task:deleted', {
      id,
      columnId: existing.columnId,
      position: existing.position,
    });

    res.json({ message: 'Task deleted successfully', id });
  } catch (err) {
    next(err);
  }
}
