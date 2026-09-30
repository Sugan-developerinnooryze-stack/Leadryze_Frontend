import api from './api';
import type { SidebarLayout } from '../stores/auth.store';

export const authService = {
  login:          (data: { email: string; password: string }) =>
                    api.post('/api/v1/auth/login', data),
  loginWithClientId: (data: { clientId: string; password: string }) =>
                    api.post('/api/v1/auth/login', data),
  register:       (data: { email: string; password: string; firstName: string; lastName: string; companyName?: string }) =>
                    api.post('/api/v1/auth/register', data),
  verifyEmail:    (data: { token: string; email: string }) =>
                    api.post('/api/v1/auth/verify-email', data),
  forgotPassword: (data: { email: string }) =>
                    api.post('/api/v1/auth/forgot-password', data),
  resetPassword:  (data: { token: string; email: string; password: string }) =>
                    api.post('/api/v1/auth/reset-password', data),
  logout:         () => api.post('/api/v1/auth/logout'),
  me:             () => api.get('/api/v1/auth/me'),
  refresh:        (refreshToken: string) => api.post('/api/v1/auth/refresh', { refreshToken }),
  updateSidebarLayout: (layout: SidebarLayout, signal?: AbortSignal) =>
                    api.put('/api/v1/auth/sidebar-layout', layout, { signal }),

  // Super admin
  adminStats:           () => api.get('/api/v1/admin/stats'),
  adminClients:         () => api.get('/api/v1/admin/clients'),
  adminUsers:           () => api.get('/api/v1/admin/users'),
  adminTenantDetail:    (id: string) => api.get(`/api/v1/admin/tenants/${id}`),
  toggleClient:         (id: string, reason?: string) => api.patch(`/api/v1/admin/clients/${id}/toggle`, reason ? { reason } : {}),
  adminGetFeatureFlags: (id: string) => api.get(`/api/v1/admin/tenants/${id}/features`),
  adminSetFeatureFlags: (id: string, flags: Record<string, boolean>, accessConfigMode?: 'default' | 'custom', maxUsers?: number | null) =>
                          api.put(`/api/v1/admin/tenants/${id}/features`, { flags, ...(accessConfigMode ? { accessConfigMode } : {}), ...(maxUsers !== undefined ? { maxUsers } : {}) }),
  adminGetPlatformDefaults: () => api.get('/api/v1/admin/platform-defaults'),
  adminSetPlatformDefaults: (flags: Record<string, boolean>) =>
                              api.put('/api/v1/admin/platform-defaults', { flags }),
  adminGetKeyStats:       () => api.get('/api/v1/admin/system/key-stats'),
  adminGetAiUsage:        () => api.get('/api/v1/admin/ai-usage'),
  adminGetConversations:  (params?: Record<string, string>) => api.get('/api/v1/admin/conversations', { params }),
  adminGetConversationDetail: (sessionId: string) => api.get(`/api/v1/admin/conversations/${sessionId}`),
  adminGetSecurityEvents:  (params?: Record<string, string>) =>
                             api.get('/api/v1/admin/security-events', { params }),
  adminGetSecurityStats:   () => api.get('/api/v1/admin/security-stats'),
  adminGetSecurityPosture: () => api.get('/api/v1/admin/security-posture'),
  adminGetConnectorHealth: () => api.get('/api/v1/admin/connector-health'),
  adminGetSessions:        () => api.get('/api/v1/admin/sessions'),
  adminTerminateSession:   (id: string) => api.delete(`/api/v1/admin/sessions/${id}`),
  adminTerminateUserSessions: (userId: string) => api.delete(`/api/v1/admin/sessions/user/${userId}/all`),
  adminGetAuditLogs:       (params?: Record<string, string>) =>
                             api.get('/api/v1/admin/audit-logs', { params }),
  adminVerifyUserEmail:    (id: string) => api.post(`/api/v1/admin/users/${id}/verify-email`),
  adminResetUserPassword:  (id: string, password?: string, sendEmail?: boolean) =>
                             api.post(`/api/v1/admin/users/${id}/reset-password`, {
                               ...(password ? { password } : {}),
                               ...(sendEmail ? { sendEmail } : {}),
                             }),

  // Tenant provisioning (Flow A: direct creation; Flow B: approval-gated signup)
  adminCreateTenant: (data: {
    name: string; plan?: string; domain?: string; contactEmail?: string; contactPhone?: string;
    adminFirstName: string; adminLastName: string; adminEmail: string;
  }) => api.post('/api/v1/admin/tenants', data),
  adminApproveTenant: (id: string) => api.post(`/api/v1/admin/tenants/${id}/approve`),
  adminRejectTenant:  (id: string) => api.post(`/api/v1/admin/tenants/${id}/reject`),
  adminCreateUser: (data: {
    tenantId: string; firstName: string; lastName: string; email: string;
    role: 'TENANT_ADMIN' | 'MANAGER' | 'AGENT' | 'USER'; password?: string;
  }) => api.post('/api/v1/admin/users', data),
};
