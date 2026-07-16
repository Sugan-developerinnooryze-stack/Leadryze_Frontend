import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService } from '../services/auth.service';
import api from '../services/api';

export interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  roleId?: string;
  tenantId: string;
  emailVerified: boolean;
  clientId?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshTokenValue: string | null;
  permissions: string[] | null; // null = full access (SUPER_ADMIN / TENANT_ADMIN); not persisted
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: { email: string; password: string; firstName: string; lastName: string; companyName?: string }) => Promise<string>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  fetchMe: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
}

function mapUser(raw: Record<string, unknown>): User {
  return {
    _id:           raw._id as string,
    email:         raw.email as string,
    firstName:     raw.firstName as string,
    lastName:      raw.lastName as string,
    role:          raw.role as string,
    roleId:        raw.roleId as string | undefined,
    tenantId:      raw.tenantId as string,
    emailVerified: raw.emailVerified as boolean,
    clientId:      raw.clientId as string | undefined,
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user:               null,
      token:              null,
      refreshTokenValue:  null,
      permissions:        null,
      isLoading:          false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const res = await authService.login({ email, password });
          const { user: raw, accessToken, refreshToken, permissions } = res.data.data;
          const user = mapUser(raw);
          set({
            user,
            token:             accessToken,
            refreshTokenValue: refreshToken,
            // permissions: null → full access (SUPER_ADMIN / TENANT_ADMIN without roleId)
            // permissions: string[] → DB-backed role permissions
            permissions:       permissions ?? null,
            isLoading:         false,
          });
          return user;
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      register: async (data) => {
        set({ isLoading: true });
        try {
          const res = await authService.register(data);
          set({ isLoading: false });
          return res.data.message as string;
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      logout: () => {
        const hasToken = !!get().token;
        set({ user: null, token: null, refreshTokenValue: null, permissions: null });
        if (hasToken) authService.logout().catch(() => {});
      },

      refreshToken: async () => {
        const refresh = get().refreshTokenValue;
        if (!refresh) throw new Error('No refresh token');
        const res = await authService.refresh(refresh);
        const { accessToken, refreshToken } = res.data.data;
        set({ token: accessToken, refreshTokenValue: refreshToken });
      },

      fetchMe: async () => {
        const res = await authService.me();
        set({ user: mapUser(res.data.data) });
        // Refresh permissions alongside user data
        await get().refreshPermissions();
      },

      refreshPermissions: async () => {
        try {
          const res = await api.get('/api/v1/roles/my-permissions');
          const data = res.data?.data;
          // data === null → full access (SUPER_ADMIN / TENANT_ADMIN)
          // data === [] or string[] → role-scoped permissions
          set({ permissions: Array.isArray(data) ? data : null });
        } catch {
          // On failure keep existing permissions — don't lock user out
        }
      },
    }),
    {
      name: 'leadryze-auth',
      // Never persist permissions — they are always refreshed from DB on login/fetchMe
      partialize: (s) => ({ token: s.token, refreshTokenValue: s.refreshTokenValue, user: s.user }),
    }
  )
);
