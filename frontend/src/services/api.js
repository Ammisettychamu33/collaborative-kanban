import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT and active tenant header
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('kanban_token');
    const tenantId = localStorage.getItem('kanban_active_tenant_id');

    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    if (tenantId) {
      config.headers['x-tenant-id'] = tenantId;
    }

    // Strip duplicate /api prefix if caller provided /api/... while baseURL already ends with /api
    if (config.url && config.url.startsWith('/api/')) {
      config.url = config.url.replace(/^\/api/, '');
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle session expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config.url.includes('/auth/login')) {
      console.warn('[API] Session expired or unauthorized, clearing token.');
      localStorage.removeItem('kanban_token');
      localStorage.removeItem('kanban_user');
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    return Promise.reject(error);
  }
);

export default api;
