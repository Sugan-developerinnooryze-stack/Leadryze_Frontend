import axios from 'axios';
import { useAuthStore } from '../stores/auth.store';
import { useBranchStore } from '../stores/branch.store';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;

  const currentBranch = useBranchStore.getState().currentBranch;
  if (currentBranch?._id) {
    config.headers['X-Branch-Id'] = currentBranch._id;
  }

  return config;
});

// Singleton refresh — prevents 30 simultaneous refresh calls when multiple requests get 401
let refreshPromise: Promise<void> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    // Only retry once per request, only on 401, not on auth endpoints themselves
    if (
      err.response?.status === 401 &&
      !original._retry &&
      !original.url?.includes('/auth/refresh') &&
      !original.url?.includes('/auth/login') &&
      !original.url?.includes('/auth/logout')
    ) {
      original._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = useAuthStore.getState().refreshToken().finally(() => {
            refreshPromise = null;
          });
        }
        await refreshPromise;
        const token = useAuthStore.getState().token;
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch {
        refreshPromise = null;
        useAuthStore.getState().logout();
      }
    }
    return Promise.reject(err);
  }
);

export default api;
