import React, { useState, useEffect } from 'react';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Users,
  X,
  UserPlus,
  Shield,
  Loader2,
  Mail,
  CheckCircle2,
} from 'lucide-react';

export function MembersModal({ isOpen, onClose }) {
  const { activeTenant, activeRole } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Invite state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canManageMembers = activeRole === 'ORG_ADMIN' || activeRole === 'TENANT_ADMIN';

  const fetchMembers = async () => {
    if (!activeTenant) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/api/tenants/${activeTenant.id}/members`);
      setMembers(res.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchMembers();
      setSuccess(null);
    }
  }, [isOpen, activeTenant]);

  if (!isOpen) return null;

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    try {
      setIsSubmitting(true);
      setError(null);
      setSuccess(null);
      await api.post(`/api/tenants/${activeTenant.id}/members`, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      setSuccess(`Successfully granted ${inviteRole} membership to ${inviteEmail}`);
      setInviteEmail('');
      fetchMembers();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to assign member');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'ORG_ADMIN':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'TENANT_ADMIN':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
      default:
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl relative max-h-[90vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">Branch Members & RBAC</h3>
            <p className="text-xs text-slate-400">
              Branch: <span className="text-sky-300 font-semibold">{activeTenant?.name}</span>
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Invite / Assign form */}
        {canManageMembers && (
          <form
            onSubmit={handleAddMember}
            className="mb-4 p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-3"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <UserPlus className="w-4 h-4 text-sky-400" />
              <span>Assign User to This Branch</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2 relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  required
                  placeholder="user@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-500"
                >
                  <option value="MEMBER">Member</option>
                  <option value="TENANT_ADMIN">Tenant Admin</option>
                  {activeRole === 'ORG_ADMIN' && <option value="ORG_ADMIN">Org Admin</option>}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 transition-all active:scale-95 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Grant Access</span>
            </button>
          </form>
        )}

        {/* Member List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[140px]">
          <div className="text-xs font-semibold text-slate-400 mb-1 flex items-center justify-between">
            <span>Enrolled Members</span>
            <span>{members.length} Users</span>
          </div>

          {loading && members.length === 0 && (
            <div className="flex flex-col items-center justify-center h-28 text-slate-500 text-xs">
              <Loader2 className="w-5 h-5 animate-spin mb-1 text-sky-400" />
              <span>Loading branch members...</span>
            </div>
          )}

          {members.map((mem) => (
            <div
              key={mem.id}
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/80 hover:border-slate-700/60 transition-all"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-500 flex items-center justify-center text-xs font-bold text-white shadow-sm">
                  {mem.user?.name
                    ?.split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase() || 'U'}
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-200">{mem.user?.name}</div>
                  <div className="text-[11px] text-slate-500">{mem.user?.email}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${getRoleBadge(
                    mem.role
                  )}`}
                >
                  {mem.role.replace('_', ' ')}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-slate-800 mt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
