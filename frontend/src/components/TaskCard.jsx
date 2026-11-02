import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Calendar,
  Layers,
} from 'lucide-react';

export function TaskCard({ task, onClick }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: 'TASK',
      task,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const getPriorityStyle = (priority) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'HIGH':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
      case 'MEDIUM':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      default:
        return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
    }
  };

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onClick(task)}
      className={`glass-card p-3 rounded-xl border cursor-pointer select-none relative group priority-${task.priority}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        {/* Priority & Version Badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md border ${getPriorityStyle(
              task.priority
            )}`}
          >
            {task.priority}
          </span>

          <span
            className="flex items-center gap-1 text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-700/50"
            title={`Optimistic Concurrency Version ${task.version}`}
          >
            <Layers className="w-2.5 h-2.5" />
            <span>v{task.version}</span>
          </span>
        </div>

        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          title="Drag to reorder or move column"
          className="text-slate-500 hover:text-slate-300 cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-slate-800/60"
        >
          <GripVertical className="w-4 h-4" />
        </div>
      </div>

      {/* Task Title */}
      <h4 className="text-sm font-semibold text-slate-100 group-hover:text-sky-300 transition-colors leading-snug mb-1">
        {task.title}
      </h4>

      {/* Description Snippet */}
      {task.description && (
        <p className="text-xs text-slate-400 line-clamp-2 mb-3 leading-relaxed">
          {task.description}
        </p>
      )}

      {/* Footer: Due date & Assignee */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/60 mt-2">
        {task.dueDate ? (
          <div
            className={`flex items-center gap-1 ${
              isOverdue ? 'text-rose-400 font-semibold' : 'text-slate-400'
            }`}
            title={`Due: ${new Date(task.dueDate).toLocaleDateString()}`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>{new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
          </div>
        ) : (
          <span />
        )}

        {task.assignee ? (
          <div
            className="flex items-center gap-1.5"
            title={`Assigned to: ${task.assignee.name} (${task.assignee.email})`}
          >
            <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-500 flex items-center justify-center text-[9px] font-bold text-white shadow-sm">
              {task.assignee.name
                ?.split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <span className="text-[11px] text-slate-300 truncate max-w-[90px]">
              {task.assignee.name.split(' ')[0]}
            </span>
          </div>
        ) : (
          <span className="text-[10px] text-slate-500 italic">Unassigned</span>
        )}
      </div>
    </div>
  );
}
