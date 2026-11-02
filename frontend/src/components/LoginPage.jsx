import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Kanban,
  ShieldCheck,
  Building2,
  Lock,
  Mail,
  User,
  ArrowRight,
  Zap,
  CheckCircle2,
  Users,
} from 'lucide-react';

export function LoginPage() {
  const { login, register, loading } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState(null);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [orgName, setOrgName] = useState('');

  const demoUsers = [
    {
      roleTitle: 'Acme Org Admin',
      org: 'Acme Technologies',
      tenant: 'All Acme Branches',
      role: 'ORG_ADMIN',
      email: 'admin.acme@example.com',
      badge: 'border-purple-500/40 text-purple-300 bg-purple-950/40',
      description: 'Full org control across Hyderabad & Bangalore branches',
    },
    {
      roleTitle: 'Hyderabad Branch Admin',
      org: 'Acme Technologies',
      tenant: 'Hyderabad Hub',
      role: 'TENANT_ADMIN',
      email: 'admin.hyd@example.com',
      badge: 'border-sky-500/40 text-sky-300 bg-sky-950/40',
      description: 'Manages boards, columns, and members in Hyderabad',
    },
    {
      roleTitle: 'Hyderabad Team Member',
      org: 'Acme Technologies',
      tenant: 'Hyderabad Hub',
      role: 'MEMBER',
      email: 'member.hyd@example.com',
      badge: 'border-emerald-500/40 text-emerald-300 bg-emerald-950/40',
      description: 'Collaborates on tasks with OCC and real-time sync',
    },
    {
      roleTitle: 'Bangalore Branch Admin',
      org: 'Acme Technologies',
      tenant: 'Bangalore Hub',
      role: 'TENANT_ADMIN',
      email: 'admin.blr@example.com',
      badge: 'border-sky-500/40 text-sky-300 bg-sky-950/40',
      description: 'Verify strict isolation: cannot see Hyderabad boards',
    },
    {
      roleTitle: 'Globex Org Admin',
      org: 'Globex Logistics',
      tenant: 'Mumbai Hub',
      role: 'ORG_ADMIN',
      email: 'admin.globex@example.com',
      badge: 'border-indigo-500/40 text-indigo-300 bg-indigo-950/40',
      description: 'Cross-org boundary test: completely isolated from Acme',
    },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      if (isRegister) {
        if (!name.trim()) throw new Error('Full name is required');
        await register(email, password, name, orgName);
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Authentication failed');
    }
  };

  const handleDemoLogin = async (demoEmail) => {
    setError(null);
    try {
      await login(demoEmail, 'Password123!');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Demo login failed');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[400px] bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[450px] h-[300px] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-4xl mx-auto w-full z-10 space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-xs font-semibold text-sky-400 mb-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Julley Online FDE Assignment • Multi-Org & Multi-Tenant Verified</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-slate-100 via-sky-200 to-indigo-300 bg-clip-text text-transparent">
            Real-Time Collaborative Kanban
          </h1>
          <p className="text-sm text-slate-400 max-w-xl mx-auto">
            Enterprise-grade project tracking with strict tenant isolation, optimistic concurrency control (OCC), WebSocket synchronization, and undo/redo capabilities.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Login / Register Form */}
          <div className="lg:col-span-5 glass-panel p-6 sm:p-8 rounded-2xl border border-slate-800/80 shadow-2xl">
            <div className="flex border-b border-slate-800 mb-6">
              <button
                type="button"
                onClick={() => {
                  setIsRegister(false);
                  setError(null);
                }}
                className={`flex-1 pb-3 text-sm font-semibold transition-all border-b-2 ${
                  !isRegister
                    ? 'border-sky-500 text-sky-400'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRegister(true);
                  setError(null);
                }}
                className={`flex-1 pb-3 text-sm font-semibold transition-all border-b-2 ${
                  isRegister
                    ? 'border-sky-500 text-sky-400'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                Create Account
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs leading-relaxed">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegister && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        required
                        placeholder="John Doe"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-sky-500 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Company / Organization</label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Optional org name"
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-sky-500 transition-all"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-sky-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-sky-500 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 rounded-xl text-sm font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-lg shadow-sky-500/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <span>{isRegister ? 'Register & Initialize Workspace' : 'Sign In'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* Right: One-Click Demo Test Accounts */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-slate-200">One-Click Evaluator Personas</h3>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">Password: Password123!</span>
            </div>

            <p className="text-xs text-slate-400">
              Click any pre-configured seed persona to instantly authenticate, test multi-tenant boundaries, or open two tabs to observe real-time drag-and-drop sync:
            </p>

            <div className="grid grid-cols-1 gap-2.5">
              {demoUsers.map((persona) => (
                <button
                  key={persona.email}
                  onClick={() => handleDemoLogin(persona.email)}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-sky-500/40 text-left transition-all group"
                >
                  <div className="space-y-1 flex-1 pr-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-200 group-hover:text-sky-300 transition-colors">
                        {persona.roleTitle}
                      </span>
                      <span
                        className={`text-[9px] font-mono uppercase font-bold px-1.5 py-0.5 rounded border ${persona.badge}`}
                      >
                        {persona.role}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        • {persona.org} ({persona.tenant})
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 leading-snug">{persona.description}</div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2 py-1 rounded border border-slate-800 group-hover:border-slate-700">
                      {persona.email.split('@')[0]}
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-sky-400 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 text-[11px] text-slate-400 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Testing Cross-Tenant Isolation:</strong> Log in as Hyderabad Admin, note the tasks, then log in as Bangalore Admin in an incognito window. Notice that Bangalore users cannot read, list, or move tasks from Hyderabad.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
