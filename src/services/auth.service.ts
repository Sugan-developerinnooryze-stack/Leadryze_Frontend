import api from './api';

export const authService = {
  login:          (data: { email: string; password: string }) =>
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

  // Super admin
  adminStats:           () => api.get('/api/v1/admin/stats'),
  adminClients:         () => api.get('/api/v1/admin/clients'),
  adminUsers:           () => api.get('/api/v1/admin/users'),
  adminTenantDetail:    (id: string) => api.get(`/api/v1/admin/tenants/${id}`),
  toggleClient:         (id: string) => api.patch(`/api/v1/admin/clients/${id}/toggle`),
  adminGetFeatureFlags: (id: string) => api.get(`/api/v1/admin/tenants/${id}/features`),
  adminSetFeatureFlags: (id: string, flags: Record<string, boolean>) =>
                          api.put(`/api/v1/admin/tenants/${id}/features`, { flags }),
  adminGetKeyStats:       () => api.get('/api/v1/admin/system/key-stats'),
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
  adminResetUserPassword:  (id: string, password: string) =>
                             api.post(`/api/v1/admin/users/${id}/reset-password`, { password }),
};
