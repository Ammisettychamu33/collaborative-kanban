import React, { useState, useEffect } from 'react';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  History,
  X,
  RefreshCw,
  Clock,
  User,
  Activity,
  Layers,
  ArrowRight,
} from 'lucide-react';

export function ActivityLogDrawer({ isOpen, onClose }) {
  const { activeTenant } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchLogs = async () => {
    if (!activeTenant) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/api/activity?limit=30');
      setLogs(res.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, activeTenant]);

  if (!isOpen) return null;

  const getActionBadgeColor = (action) => {
    switch (action) {
      case 'CREATE':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'UPDATE':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
      case 'MOVE':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
      case 'DELETE':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'UNDO':
      case 'REDO':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      default:
        return 'bg-slate-700/50 text-slate-300 border-slate-600/40';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">Audit Activity Logs</h3>
              <p className="text-[11px] text-slate-400">
                Tenant: <span className="text-sky-300 font-medium">{activeTenant?.name}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchLogs}
              disabled={loading}
              title="Refresh logs"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
              {error}
            </div>
          )}

          {loading && logs.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mb-2 text-sky-400" />
              <span>Loading audit logs...</span>
            </div>
          )}

          {!loading && logs.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
              <Activity className="w-6 h-6 mb-2 text-slate-600" />
              <span>No recorded activity yet</span>
            </div>
          )}

          {logs.map((log) => {
            const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
            return (
              <div
                key={log.id}
                className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 transition-all text-xs space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase ${getActionBadgeColor(
                        log.action
                      )}`}
                    >
                      {log.action}
                    </span>
                    <span className="font-semibold text-slate-300">{log.entityType}</span>
                  </div>

                  <div className="flex items-center gap-1 text-[10px] text-slate-500">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-slate-300 font-medium">{log.user?.name || 'System User'}</span>
                  <span className="text-slate-600">({log.user?.email})</span>
                </div>

                {details && (
                  <div className="bg-slate-900/90 rounded-lg p-2 text-[11px] text-slate-300 font-mono border border-slate-800">
                    {details.title && <div className="font-sans font-semibold text-slate-200 truncate">{details.title}</div>}
                    {details.fromColumn && details.toColumn && (
                      <div className="flex items-center gap-1 text-slate-400 text-[10px] mt-0.5">
                        <span>Moved:</span>
                        <span className="text-indigo-400 truncate max-w-[80px]">{details.fromColumn}</span>
                        <ArrowRight className="w-3 h-3" />
                        <span className="text-sky-400 truncate max-w-[80px]">{details.toColumn}</span>
                      </div>
                    )}
                    {details.version && (
                      <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Layers className="w-2.5 h-2.5" />
                        <span>Committed at OCC v{details.version}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
