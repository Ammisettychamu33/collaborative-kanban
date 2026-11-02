import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  FolderKanban,
  Plus,
  Search,
  Filter,
} from 'lucide-react';

export function BoardHeader({
  boards,
  activeBoard,
  onSelectBoard,
  onOpenCreateBoard,
  searchQuery,
  onSearchChange,
  priorityFilter,
  onPriorityChange,
}) {
  const { activeRole } = useAuth();
  const canManageBoards = activeRole === 'ORG_ADMIN' || activeRole === 'TENANT_ADMIN';

  return (
    <div className="bg-slate-900/60 border-b border-slate-800/80 px-6 py-4">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Board Selector and Info */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/20 to-sky-500/20 border border-indigo-500/30 text-indigo-400">
            <FolderKanban className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <select
                value={activeBoard?.id || ''}
                onChange={(e) => onSelectBoard(e.target.value)}
                className="bg-slate-800/90 hover:bg-slate-800 text-slate-100 font-bold text-lg rounded-lg border border-slate-700/80 px-3 py-1 outline-none cursor-pointer focus:ring-2 focus:ring-sky-500/50"
              >
                {boards.map((b) => (
                  <option key={b.id} value={b.id} className="bg-slate-900 text-slate-100">
                    {b.name}
                  </option>
                ))}
              </select>

              {canManageBoards && (
                <button
                  onClick={onOpenCreateBoard}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs shadow-md shadow-sky-500/20 transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Board</span>
                </button>
              )}
            </div>

            {activeBoard?.description && (
              <p className="text-xs text-slate-400 mt-1 max-w-xl truncate">
                {activeBoard.description}
              </p>
            )}
          </div>
        </div>

        {/* Right: Search & Filters */}
        <div className="flex items-center gap-3">
          {/* Real-time search */}
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search tasks by title..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
            />
          </div>

          {/* Priority filter */}
          <div className="flex items-center gap-1.5 bg-slate-950/70 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={priorityFilter}
              onChange={(e) => onPriorityChange(e.target.value)}
              className="bg-transparent text-slate-200 outline-none cursor-pointer text-xs"
            >
              <option value="ALL" className="bg-slate-900">All Priorities</option>
              <option value="URGENT" className="bg-slate-900">Urgent</option>
              <option value="HIGH" className="bg-slate-900">High</option>
              <option value="MEDIUM" className="bg-slate-900">Medium</option>
              <option value="LOW" className="bg-slate-900">Low</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
