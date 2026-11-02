import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TaskCard } from './TaskCard.jsx';
import { Plus } from 'lucide-react';

export function Column({ column, tasks, onTaskClick, onAddTask }) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: {
      type: 'COLUMN',
      column,
    },
  });

  const taskIds = tasks.map((t) => t.id);

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col w-80 shrink-0 bg-slate-900/60 rounded-2xl border transition-colors max-h-[calc(100vh-180px)] ${
        isOver
          ? 'border-sky-500/60 bg-sky-950/20 ring-1 ring-sky-500/40'
          : 'border-slate-800/80'
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-sm text-slate-200 tracking-wide">{column.name}</h3>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60">
            {tasks.length}
          </span>
        </div>

        <button
          onClick={() => onAddTask(column.id)}
          title={`Add task to ${column.name}`}
          className="p-1 rounded-md text-slate-400 hover:text-sky-300 hover:bg-slate-800/80 transition-all"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Task List (Sortable Area) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[120px]">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={onTaskClick} />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-slate-800/80 rounded-xl text-slate-600 text-xs">
            <span>No tasks in this column</span>
            <button
              onClick={() => onAddTask(column.id)}
              className="mt-2 text-sky-400 hover:underline font-medium text-xs"
            >
              + Create a task
            </button>
          </div>
        )}
      </div>

      {/* Add Task Button at footer */}
      <div className="p-2 border-t border-slate-800/60">
        <button
          onClick={() => onAddTask(column.id)}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition-all border border-transparent hover:border-slate-700/60"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add task</span>
        </button>
      </div>
    </div>
  );
}
