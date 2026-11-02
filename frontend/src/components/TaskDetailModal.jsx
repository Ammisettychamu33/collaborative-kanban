import React, { useState, useEffect } from 'react';
import api from '../services/api.js';
import {
  X,
  Calendar,
  Layers,
  User,
  Clock,
  Trash2,
  Save,
  History,
} from 'lucide-react';

export function TaskDetailModal({ task, isOpen, onClose, onUpdate, onDelete, tenantMembers }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [activityLogs, setActivityLogs] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setPriority(task.priority || 'MEDIUM');
      setAssignedTo(task.assignedTo || '');
      setDueDate(task.dueDate ? task.dueDate.split('T')[0] : '');

      // Fetch task details including task-specific audit logs
      api
        .get(`/tasks/${task.id}`)
        .then((res) => {
          setActivityLogs(res.data.activityLogs || []);
        })
        .catch((err) => console.warn('[TaskModal] Failed to fetch task activity:', err.message));
    }
  }, [task]);

  if (!isOpen || !task) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSaving(true);
    try {
      await onUpdate({
        taskId: task.id,
        updates: {
          title: title.trim(),
          description: description.trim() || null,
          priority,
          assignedTo: assignedTo || null,
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
          version: task.version, // Required for OCC!
        },
      });
      onClose();
    } catch (err) {
      console.error('[TaskModal] Update failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to permanently delete this task?')) return;
    setIsDeleting(true);
    try {
      await onDelete(task.id);
      onClose();
    } catch (err) {
      console.error('[TaskModal] Delete failed:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel w-full max-w-2xl rounded-2xl border border-slate-700/80 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <span>Version {task.version}</span>
            </span>
            <span className="text-xs text-slate-400">Task Details</span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 font-medium"
              placeholder="Task summary..."
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Description
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 leading-relaxed"
              placeholder="Add detailed task notes or acceptance criteria..."
            />
          </div>

          {/* Grid: Priority, Assignee, Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Priority */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-sky-500"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            {/* Assignee */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                <span>Assignee</span>
              </label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-sky-500"
              >
                <option value="">Unassigned</option>
                {tenantMembers.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name} ({m.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>Due Date</span>
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Metadata Footer */}
          <div className="pt-3 border-t border-slate-800 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Created: {new Date(task.createdAt).toLocaleString()}</span>
            </div>
            {task.creator && <span>By: {task.creator.name}</span>}
          </div>

          {/* Task-Specific Audit Logs */}
          {activityLogs.length > 0 && (
            <div className="pt-3 border-t border-slate-800">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                <History className="w-3.5 h-3.5 text-sky-400" />
                <span>Task History</span>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {activityLogs.map((log) => (
                  <div
                    key={log.id}
                    className="text-[11px] p-2 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between text-slate-300"
                  >
                    <div>
                      <span className="font-semibold text-sky-400">{log.user?.name}:</span>{' '}
                      <span className="text-slate-300 font-mono text-[10px] uppercase px-1 rounded bg-slate-800 border border-slate-700 mr-1">
                        {log.action}
                      </span>
                    </div>
                    <span className="text-slate-500 text-[10px]">
                      {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </form>

        {/* Modal Actions Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900/90 border-t border-slate-800">
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 text-xs font-semibold transition-all border border-rose-900/30"
          >
            <Trash2 className="w-4 h-4" />
            <span>{isDeleting ? 'Deleting...' : 'Delete Task'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200 text-xs font-medium hover:bg-slate-800 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold shadow-lg shadow-sky-500/20 transition-all active:scale-95 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
