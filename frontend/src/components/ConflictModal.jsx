import React from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';

export function ConflictModal({ conflict, onClose, onRefresh }) {
  if (!conflict) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl shadow-amber-500/10 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">Concurrency Conflict Detected</h3>
            <p className="text-xs text-amber-400 font-medium">HTTP 409 Optimistic Concurrency Control</p>
          </div>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed mb-4">
          Another collaborator modified this task while you were editing it. To prevent overwriting their changes, the server rejected your stale version (
          <span className="font-mono text-amber-300 font-bold">v{conflict.attemptedVersion}</span>).
        </p>

        {conflict.currentTask && (
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 mb-4 text-xs">
            <div className="text-slate-400 font-semibold mb-1">Authoritative Server State:</div>
            <div className="text-slate-200 font-bold">{conflict.currentTask.title}</div>
            <div className="flex items-center gap-3 text-slate-400 mt-1">
              <span>Current Version: <strong className="text-sky-400 font-mono">v{conflict.currentTask.version}</strong></span>
              <span>Priority: <strong className="text-slate-300">{conflict.currentTask.priority}</strong></span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-all"
          >
            Dismiss
          </button>

          <button
            onClick={() => {
              onRefresh();
              onClose();
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 transition-all active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reload Latest State</span>
          </button>
        </div>
      </div>
    </div>
  );
}
