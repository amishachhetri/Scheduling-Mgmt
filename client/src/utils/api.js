import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  withCredentials: true
});

api.interceptors.response.use(
  res => res,
  err => {
    console.error('API error:', err.response?.data || err.message);
    // A 401 mid-session (expired/invalidated cookie) otherwise just fails silently on whatever
    // action triggered it -- send the admin back to login instead. Excludes the two auth
    // endpoints themselves: /session's 401 is the normal "not logged in yet" signal AdminAuthGate
    // already handles, and /login's 401 is just "wrong password," shown inline on that page.
    const url = err.config?.url || '';
    const isAuthEndpoint = url.includes('/admin/auth/session') || url.includes('/admin/auth/login');
    if (err.response?.status === 401 && !isAuthEndpoint && !window.location.pathname.startsWith('/admin/login')) {
      window.location.href = '/admin/login';
    }
    return Promise.reject(err);
  }
);

export default api;
