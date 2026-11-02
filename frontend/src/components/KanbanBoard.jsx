import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { Column } from './Column.jsx';
import { TaskCard } from './TaskCard.jsx';
import { TaskDetailModal } from './TaskDetailModal.jsx';
import { CreateTaskModal } from './CreateTaskModal.jsx';
import { ConflictModal } from './ConflictModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { useUndoRedo } from '../context/UndoRedoContext.jsx';
import api from '../services/api.js';
import { Loader2, Plus, AlertCircle, LayoutDashboard } from 'lucide-react';

export function KanbanBoard({
  activeBoard,
  searchQuery = '',
  priorityFilter = 'ALL',
  onNotification,
}) {
  const { activeTenant, activeRole } = useAuth();
  const { socket, isConnected } = useSocket();
  const { pushAction } = useUndoRedo();

  const [columns, setColumns] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals state
  const [selectedTask, setSelectedTask] = useState(null);
  const [createColumnId, setCreateColumnId] = useState(null);
  const [activeDragTask, setActiveDragTask] = useState(null);
  const [conflictData, setConflictData] = useState(null);
  const [tenantMembers, setTenantMembers] = useState([]);

  // Configure DND Sensors (require 5px movement to distinguish click from drag)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  // Fetch Board Data (Columns and Tasks)
  const fetchBoardData = useCallback(async () => {
    if (!activeBoard?.id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/boards/${activeBoard.id}`);
      const boardData = res.data.data;
      setColumns(boardData.columns || []);
      setTasks(boardData.tasks || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load board details');
    } finally {
      setLoading(false);
    }
  }, [activeBoard?.id]);

  // Fetch Tenant Members for assignee dropdowns
  const fetchTenantMembers = useCallback(async () => {
    if (!activeTenant?.id) return;
    try {
      const res = await api.get(`/tenants/${activeTenant.id}/members`);
      const members = res.data.data.map((m) => ({
        userId: m.userId,
        name: m.user?.name || m.user?.email,
        email: m.user?.email,
        role: m.role,
      }));
      setTenantMembers(members);
    } catch (err) {
      console.warn('[KanbanBoard] Failed to fetch tenant members:', err.message);
    }
  }, [activeTenant?.id]);

  useEffect(() => {
    fetchBoardData();
    fetchTenantMembers();
  }, [fetchBoardData, fetchTenantMembers]);

  // Real-time synchronization listeners via Socket.IO
  useEffect(() => {
    if (!socket) return;

    // Handle incoming real-time events scoped to this tenant & board
    const handleTaskCreated = (newTask) => {
      if (newTask.boardId === activeBoard?.id) {
        setTasks((prev) => {
          if (prev.some((t) => t.id === newTask.id)) return prev;
          return [...prev, newTask];
        });
      }
    };

    const handleTaskUpdated = (updatedTask) => {
      if (updatedTask.boardId === activeBoard?.id) {
        setTasks((prev) =>
          prev.map((t) => (t.id === updatedTask.id ? { ...t, ...updatedTask } : t))
        );
        if (selectedTask?.id === updatedTask.id) {
          setSelectedTask((prev) => ({ ...prev, ...updatedTask }));
        }
      }
    };

    const handleTaskMoved = (movedData) => {
      if (movedData.boardId === activeBoard?.id) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === movedData.id
              ? {
                  ...t,
                  columnId: movedData.columnId,
                  position: movedData.position,
                  version: movedData.version,
                }
              : t
          )
        );
      }
    };

    const handleTaskDeleted = (deletedData) => {
      setTasks((prev) => prev.filter((t) => t.id !== deletedData.id));
      if (selectedTask?.id === deletedData.id) {
        setSelectedTask(null);
      }
    };

    const handleColumnCreated = (newCol) => {
      if (newCol.boardId === activeBoard?.id) {
        setColumns((prev) => {
          if (prev.some((c) => c.id === newCol.id)) return prev;
          return [...prev, newCol].sort((a, b) => a.position - b.position);
        });
      }
    };

    const handleColumnDeleted = (delCol) => {
      setColumns((prev) => prev.filter((c) => c.id !== delCol.id));
      setTasks((prev) => prev.filter((t) => t.columnId !== delCol.id));
    };

    // Reconnection listener: refresh authoritative state in case events were missed
    const handleReconnect = () => {
      console.log('[KanbanBoard] Socket reconnected, reconciling authoritative board state...');
      fetchBoardData();
    };

    socket.on('task:created', handleTaskCreated);
    socket.on('task:updated', handleTaskUpdated);
    socket.on('task:moved', handleTaskMoved);
    socket.on('task:deleted', handleTaskDeleted);
    socket.on('column:created', handleColumnCreated);
    socket.on('column:deleted', handleColumnDeleted);
    socket.on('connect', handleReconnect);

    return () => {
      socket.off('task:created', handleTaskCreated);
      socket.off('task:updated', handleTaskUpdated);
      socket.off('task:moved', handleTaskMoved);
      socket.off('task:deleted', handleTaskDeleted);
      socket.off('column:created', handleColumnCreated);
      socket.off('column:deleted', handleColumnDeleted);
      socket.off('connect', handleReconnect);
    };
  }, [socket, activeBoard?.id, selectedTask?.id, fetchBoardData]);

  // Filter tasks based on Search Query and Priority
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchesSearch = searchQuery
        ? t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.description?.toLowerCase().includes(searchQuery.toLowerCase())
        : true;
      const matchesPriority = priorityFilter !== 'ALL' ? t.priority === priorityFilter : true;
      return matchesSearch && matchesPriority;
    });
  }, [tasks, searchQuery, priorityFilter]);

  // Group tasks by Column ID
  const tasksByColumn = useMemo(() => {
    const map = {};
    columns.forEach((col) => {
      map[col.id] = [];
    });
    filteredTasks.forEach((task) => {
      if (map[task.columnId]) {
        map[task.columnId].push(task);
      }
    });
    // Sort tasks in each column by position ascending
    Object.keys(map).forEach((colId) => {
      map[colId].sort((a, b) => a.position - b.position);
    });
    return map;
  }, [columns, filteredTasks]);

  // Drag and Drop Event Handlers
  const handleDragStart = (event) => {
    const { active } = event;
    const task = tasks.find((t) => t.id === active.id);
    if (task) {
      setActiveDragTask(task);
    }
  };

  const handleDragOver = (event) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveTask = active.data.current?.type === 'TASK';
    const isOverTask = over.data.current?.type === 'TASK';
    const isOverColumn = over.data.current?.type === 'COLUMN';

    if (!isActiveTask) return;

    // Moving a task over another task in another column
    if (isOverTask) {
      const activeTask = tasks.find((t) => t.id === activeId);
      const overTask = tasks.find((t) => t.id === overId);

      if (activeTask && overTask && activeTask.columnId !== overTask.columnId) {
        setTasks((prev) => {
          return prev.map((t) => {
            if (t.id === activeId) {
              return { ...t, columnId: overTask.columnId };
            }
            return t;
          });
        });
      }
    }

    // Moving a task directly over a Column container
    if (isOverColumn) {
      const activeTask = tasks.find((t) => t.id === activeId);
      if (activeTask && activeTask.columnId !== overId) {
        setTasks((prev) => {
          return prev.map((t) => {
            if (t.id === activeId) {
              return { ...t, columnId: overId };
            }
            return t;
          });
        });
      }
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveDragTask(null);

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    const currentTask = tasks.find((t) => t.id === activeId);
    if (!currentTask) return;

    // Determine target column and position
    let targetColumnId = currentTask.columnId;
    let targetPosition = 0;

    const isOverTask = over.data.current?.type === 'TASK';
    const isOverColumn = over.data.current?.type === 'COLUMN';

    if (isOverTask) {
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) {
        targetColumnId = overTask.columnId;
        const columnTasks = (tasksByColumn[targetColumnId] || []).filter((t) => t.id !== activeId);
        const overIndex = columnTasks.findIndex((t) => t.id === overId);
        targetPosition = overIndex >= 0 ? overIndex : columnTasks.length;
      }
    } else if (isOverColumn) {
      targetColumnId = overId;
      const columnTasks = (tasksByColumn[targetColumnId] || []).filter((t) => t.id !== activeId);
      targetPosition = columnTasks.length;
    }

    // Previous state snapshot for rollback & undo
    const previousSnapshot = {
      columnId: activeDragTask?.columnId || currentTask.columnId,
      position: activeDragTask?.position ?? currentTask.position,
      version: currentTask.version,
    };

    // If no meaningful change in position or column, no-op
    if (
      previousSnapshot.columnId === targetColumnId &&
      previousSnapshot.position === targetPosition
    ) {
      return;
    }

    // Optimistic UI update
    setTasks((prev) => {
      const withoutTask = prev.filter((t) => t.id !== activeId);
      const updatedTask = {
        ...currentTask,
        columnId: targetColumnId,
        position: targetPosition,
        version: currentTask.version + 1,
      };
      return [...withoutTask, updatedTask];
    });

    try {
      const res = await api.patch(`/tasks/${activeId}/move`, {
        columnId: targetColumnId,
        position: targetPosition,
        version: currentTask.version, // Concurrency OCC check
      });

      const committedTask = res.data.data;

      // Update state with server-authoritative task
      setTasks((prev) =>
        prev.map((t) => (t.id === committedTask.id ? { ...t, ...committedTask } : t))
      );

      // Register undo action in history stack
      pushAction({
        type: 'MOVE',
        taskId: activeId,
        payload: { columnId: targetColumnId, position: targetPosition },
        inversePayload: {
          columnId: previousSnapshot.columnId,
          position: previousSnapshot.position,
        },
        version: committedTask.version,
      });

      if (onNotification) {
        onNotification({
          type: 'success',
          message: `Moved "${currentTask.title}" to ${targetColumnId ? 'new column' : ''}`,
        });
      }
    } catch (err) {
      console.error('[KanbanBoard] Task move failed:', err);

      // Rollback to previous state
      setTasks((prev) =>
        prev.map((t) => (t.id === activeId ? { ...t, ...previousSnapshot } : t))
      );

      // Check for Concurrency Conflict (HTTP 409)
      if (err.response?.status === 409) {
        setConflictData({
          attemptedVersion: currentTask.version,
          currentTask: err.response.data?.currentTask,
          message: err.response.data?.message || 'Task was modified concurrently by another user.',
        });
      } else {
        alert(err.response?.data?.message || 'Failed to move task. Reverted changes.');
      }
    }
  };

  // Task Creation Handler
  const handleCreateTask = async (taskPayload) => {
    try {
      const res = await api.post('/tasks', taskPayload);
      const created = res.data.data;
      setTasks((prev) => [...prev, created]);
      if (onNotification) {
        onNotification({ type: 'success', message: `Task "${created.title}" created successfully` });
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create task');
      throw err;
    }
  };

  // Task Update Handler (with OCC)
  const handleUpdateTask = async ({ taskId, updates }) => {
    const previousTask = tasks.find((t) => t.id === taskId);
    if (!previousTask) return;

    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...updates, version: t.version + 1 } : t))
    );

    try {
      const res = await api.put(`/tasks/${taskId}`, updates);
      const updated = res.data.data;
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));

      // Push to undo stack
      pushAction({
        type: 'EDIT',
        taskId,
        payload: updates,
        inversePayload: {
          title: previousTask.title,
          description: previousTask.description,
          priority: previousTask.priority,
          assignedTo: previousTask.assignedTo,
          dueDate: previousTask.dueDate,
        },
        version: updated.version,
      });

      if (onNotification) {
        onNotification({ type: 'success', message: 'Task updated successfully' });
      }
    } catch (err) {
      // Rollback
      setTasks((prev) => prev.map((t) => (t.id === taskId ? previousTask : t)));

      if (err.response?.status === 409) {
        setConflictData({
          attemptedVersion: updates.version,
          currentTask: err.response.data?.currentTask,
          message: err.response.data?.message,
        });
      } else {
        alert(err.response?.data?.message || 'Failed to update task');
      }
      throw err;
    }
  };

  // Task Deletion Handler
  const handleDeleteTask = async (taskId) => {
    const taskToDelete = tasks.find((t) => t.id === taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    try {
      await api.delete(`/tasks/${taskId}`);
      if (onNotification) {
        onNotification({
          type: 'success',
          message: `Task "${taskToDelete?.title || ''}" deleted`,
        });
      }
    } catch (err) {
      if (taskToDelete) {
        setTasks((prev) => [...prev, taskToDelete]);
      }
      alert(err.response?.data?.message || 'Failed to delete task');
    }
  };

  // Create Default Columns if board has none
  const handleCreateDefaultColumns = async () => {
    if (!activeBoard?.id) return;
    const defaults = ['To Do', 'In Progress', 'Testing', 'Done'];
    try {
      for (let i = 0; i < defaults.length; i++) {
        await api.post(`/boards/${activeBoard.id}/columns`, {
          name: defaults[i],
          position: i,
        });
      }
      fetchBoardData();
    } catch (err) {
      alert('Failed to generate default columns: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-sky-400 mb-3" />
        <span className="text-sm font-medium">Loading collaborative board...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
        <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 mb-3">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h3 className="text-base font-bold text-slate-100 mb-1">Failed to load board</h3>
        <p className="text-xs text-slate-400 max-w-sm mb-4">{error}</p>
        <button
          onClick={fetchBoardData}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-sky-500 text-slate-950 hover:bg-sky-400 transition-all"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-x-auto p-6">
      {/* Empty columns state */}
      {columns.length === 0 ? (
        <div className="max-w-md mx-auto my-16 text-center glass-panel p-8 rounded-2xl border border-slate-800 space-y-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Empty Kanban Board</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              This board has no workflow columns yet. Set up the standard workflow to start collaborating.
            </p>
          </div>
          <button
            onClick={handleCreateDefaultColumns}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold shadow-lg shadow-sky-500/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Generate Standard Columns (To Do, In Progress, Testing, Done)</span>
          </button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex items-start gap-4 pb-4">
            {columns.map((column) => (
              <Column
                key={column.id}
                column={column}
                tasks={tasksByColumn[column.id] || []}
                onTaskClick={(task) => setSelectedTask(task)}
                onAddTask={(colId) => setCreateColumnId(colId)}
              />
            ))}
          </div>

          <DragOverlay>
            {activeDragTask ? <TaskCard task={activeDragTask} onClick={() => {}} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Task Creation Modal */}
      <CreateTaskModal
        isOpen={Boolean(createColumnId)}
        onClose={() => setCreateColumnId(null)}
        onCreate={handleCreateTask}
        columnId={createColumnId}
        boardId={activeBoard?.id}
        tenantMembers={tenantMembers}
      />

      {/* Task Detail Modal */}
      <TaskDetailModal
        isOpen={Boolean(selectedTask)}
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onUpdate={handleUpdateTask}
        onDelete={handleDeleteTask}
        tenantMembers={tenantMembers}
      />

      {/* Concurrency Conflict Modal */}
      <ConflictModal
        conflict={conflictData}
        onClose={() => setConflictData(null)}
        onRefresh={fetchBoardData}
      />
    </div>
  );
}
