import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('kanban_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('kanban_token'));
  const [organizations, setOrganizations] = useState([]);
  const [activeOrg, setActiveOrg] = useState(null);
  const [activeTenant, setActiveTenant] = useState(null);
  const [activeRole, setActiveRole] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch current user and authorized organizations
  const fetchUserContext = useCallback(async (authToken) => {
    try {
      setIsLoading(true);
      const res = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const { user: userData, organizations: orgs } = res.data;
      setUser(userData);
      setOrganizations(orgs);
      localStorage.setItem('kanban_user', JSON.stringify(userData));

      if (orgs.length > 0) {
        // Retrieve or select active org
        const savedOrgId = localStorage.getItem('kanban_active_org_id');
        const matchedOrg = orgs.find((o) => o.id === savedOrgId) || orgs[0];
        setActiveOrg(matchedOrg);
        localStorage.setItem('kanban_active_org_id', matchedOrg.id);

        // Retrieve or select active tenant
        if (matchedOrg.tenants && matchedOrg.tenants.length > 0) {
          const savedTenantId = localStorage.getItem('kanban_active_tenant_id');
          const matchedTenant =
            matchedOrg.tenants.find((t) => t.id === savedTenantId) || matchedOrg.tenants[0];
          setActiveTenant(matchedTenant);
          setActiveRole(matchedTenant.role || matchedOrg.role);
          localStorage.setItem('kanban_active_tenant_id', matchedTenant.id);
        } else {
          setActiveTenant(null);
          setActiveRole(matchedOrg.role);
          localStorage.removeItem('kanban_active_tenant_id');
        }
      }
    } catch (err) {
      console.error('[Auth] Failed to restore session:', err.message);
      logout();
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchUserContext(token);
    } else {
      setIsLoading(false);
    }

    const handleUnauthorized = () => logout();
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [token, fetchUserContext]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { token: newToken, user: userData, organizations: orgs } = res.data;

    setToken(newToken);
    setUser(userData);
    setOrganizations(orgs);
    localStorage.setItem('kanban_token', newToken);
    localStorage.setItem('kanban_user', JSON.stringify(userData));

    if (orgs.length > 0) {
      const firstOrg = orgs[0];
      setActiveOrg(firstOrg);
      localStorage.setItem('kanban_active_org_id', firstOrg.id);

      if (firstOrg.tenants?.length > 0) {
        const firstTenant = firstOrg.tenants[0];
        setActiveTenant(firstTenant);
        setActiveRole(firstTenant.role || firstOrg.role);
        localStorage.setItem('kanban_active_tenant_id', firstTenant.id);
      }
    }

    return res.data;
  };

  const register = async (arg1, arg2, arg3, arg4) => {
    let payload;
    if (typeof arg1 === 'object' && arg1 !== null) {
      payload = arg1;
    } else {
      payload = {
        email: arg1,
        password: arg2,
        name: arg3,
        organizationName: arg4,
      };
    }

    const res = await api.post('/auth/register', payload);

    const { token: newToken, user: userData } = res.data;
    setToken(newToken);
    setUser(userData);
    localStorage.setItem('kanban_token', newToken);
    localStorage.setItem('kanban_user', JSON.stringify(userData));

    await fetchUserContext(newToken);
    return res.data;
  };

  const switchOrganization = (orgId) => {
    const targetOrg = organizations.find((o) => o.id === orgId);
    if (!targetOrg) return;

    setActiveOrg(targetOrg);
    localStorage.setItem('kanban_active_org_id', targetOrg.id);

    if (targetOrg.tenants?.length > 0) {
      const firstTenant = targetOrg.tenants[0];
      setActiveTenant(firstTenant);
      setActiveRole(firstTenant.role || targetOrg.role);
      localStorage.setItem('kanban_active_tenant_id', firstTenant.id);
    } else {
      setActiveTenant(null);
      setActiveRole(targetOrg.role);
      localStorage.removeItem('kanban_active_tenant_id');
    }
  };

  const switchTenant = (tenantId) => {
    if (!activeOrg || !activeOrg.tenants) return;
    const targetTenant = activeOrg.tenants.find((t) => t.id === tenantId);
    if (!targetTenant) return;

    setActiveTenant(targetTenant);
    setActiveRole(targetTenant.role || activeOrg.role);
    localStorage.setItem('kanban_active_tenant_id', targetTenant.id);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setOrganizations([]);
    setActiveOrg(null);
    setActiveTenant(null);
    setActiveRole(null);
    localStorage.removeItem('kanban_token');
    localStorage.removeItem('kanban_user');
    localStorage.removeItem('kanban_active_org_id');
    localStorage.removeItem('kanban_active_tenant_id');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        organizations,
        activeOrg,
        activeTenant,
        activeRole,
        isLoading,
        login,
        register,
        logout,
        switchOrganization,
        switchTenant,
        refreshContext: () => token && fetchUserContext(token),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
