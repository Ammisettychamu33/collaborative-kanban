import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { useUndoRedo } from '../context/UndoRedoContext.jsx';
import {
  Kanban,
  Building2,
  GitBranch,
  ShieldAlert,
  Users,
  History,
  Undo2,
  Redo2,
  LogOut,
  Wifi,
  WifiOff,
} from 'lucide-react';

export function Navbar({ onOpenActivity, onOpenMembers, onUndo, onRedo }) {
  const {
    user,
    organizations,
    activeOrg,
    activeTenant,
    activeRole,
    switchOrganization,
    switchTenant,
    logout,
  } = useAuth();

  const { isConnected, onlineUsers } = useSocket();
  const { canUndo, canRedo } = useUndoRedo();

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'ORG_ADMIN':
        return 'bg-purple-900/60 text-purple-300 border-purple-500/40';
      case 'TENANT_ADMIN':
        return 'bg-sky-900/60 text-sky-300 border-sky-500/40';
      default:
        return 'bg-emerald-900/60 text-emerald-300 border-emerald-500/40';
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-slate-800/80 px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand & Connection Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-bold text-lg tracking-tight bg-gradient-to-r from-sky-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
            <div className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <Kanban className="w-5 h-5" />
            </div>
            <span>Julley Kanban</span>
          </div>

          <div
            title={isConnected ? 'Live WebSocket Connected' : 'Reconnecting to real-time sync...'}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all ${
              isConnected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse'
            }`}
          >
            {isConnected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <Wifi className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Live</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Connecting...</span>
              </>
            )}
          </div>
        </div>

        {/* Center: Org & Tenant Switchers */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Organization Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300">
            <Building2 className="w-3.5 h-3.5 text-indigo-400" />
            <select
              value={activeOrg?.id || ''}
              onChange={(e) => switchOrganization(e.target.value)}
              className="bg-transparent text-slate-200 outline-none cursor-pointer pr-1 font-medium"
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id} className="bg-slate-900 text-slate-200">
                  {org.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tenant / Branch Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300">
            <GitBranch className="w-3.5 h-3.5 text-sky-400" />
            <select
              value={activeTenant?.id || ''}
              onChange={(e) => switchTenant(e.target.value)}
              className="bg-transparent text-slate-200 outline-none cursor-pointer pr-1 font-medium"
            >
              {activeOrg?.tenants?.map((t) => (
                <option key={t.id} value={t.id} className="bg-slate-900 text-slate-200">
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Active Role Badge */}
          {activeRole && (
            <span
              className={`text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-md border ${getRoleBadgeColor(
                activeRole
              )}`}
            >
              {activeRole.replace('_', ' ')}
            </span>
          )}
        </div>

        {/* Right: Presence, Undo/Redo, Drawers, User */}
        <div className="flex items-center gap-2">
          {/* Presence Avatars */}
          <div className="hidden md:flex items-center -space-x-2 mr-1" title={`${onlineUsers.length} users online in this tenant`}>
            {onlineUsers.slice(0, 4).map((u, i) => (
              <div
                key={u.id || i}
                title={`${u.name} (${u.email}) - Online`}
                className="w-7 h-7 rounded-full bg-gradient-to-tr from-sky-600 to-indigo-600 border-2 border-slate-900 flex items-center justify-center text-[10px] font-bold text-white shadow"
              >
                {u.name
                  ?.split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
            ))}
            {onlineUsers.length > 4 && (
              <div className="w-7 h-7 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-[10px] text-slate-300">
                +{onlineUsers.length - 4}
              </div>
            )}
          </div>

          {/* Undo / Redo Controls */}
          <div className="flex items-center gap-1 border-r border-slate-800 pr-2">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo last task movement/edit (Ctrl+Z)"
              className={`p-1.5 rounded-md transition-all ${
                canUndo
                  ? 'text-slate-300 hover:text-white hover:bg-slate-800 active:scale-95'
                  : 'text-slate-600 cursor-not-allowed'
              }`}
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo action (Ctrl+Y)"
              className={`p-1.5 rounded-md transition-all ${
                canRedo
                  ? 'text-slate-300 hover:text-white hover:bg-slate-800 active:scale-95'
                  : 'text-slate-600 cursor-not-allowed'
              }`}
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          {/* Activity Drawer Trigger */}
          <button
            onClick={onOpenActivity}
            title="Tenant Activity Audit History"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-all"
          >
            <History className="w-4 h-4" />
          </button>

          {/* Members Management Trigger */}
          <button
            onClick={onOpenMembers}
            title="Tenant Members & Roles"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-all"
          >
            <Users className="w-4 h-4" />
          </button>

          {/* User Info & Logout */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
            <div className="hidden lg:block text-right">
              <div className="text-xs font-semibold text-slate-200 leading-tight">{user?.name}</div>
              <div className="text-[10px] text-slate-400 leading-tight">{user?.email}</div>
            </div>

            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 rounded-md text-rose-400/80 hover:text-rose-300 hover:bg-rose-950/30 transition-all"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
