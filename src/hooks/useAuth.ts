import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/auth.store';

// The backend's `validate` middleware responds with a generic "Validation
// failed" message plus a per-field `errors` map (zod's flattened fieldErrors,
// e.g. { password: ["Password must contain at least one uppercase letter"] }).
// Surface the actual field message instead of the generic one so the user
// knows what to fix, not just that something failed.
function extractErrorMessage(err: unknown, fallback: string): string {
  const data = (err as {
    response?: { data?: { message?: string; errors?: Record<string, string[]> } };
  })?.response?.data;
  const fieldMessages = data?.errors ? Object.values(data.errors).flat().filter(Boolean) : [];
  if (fieldMessages.length) return fieldMessages.join(' ');
  return data?.message || fallback;
}

export function useAuth() {
  const navigate = useNavigate();
  const { user, token, isLoading, login, register, logout } = useAuthStore();

  const handleLogin = useCallback(
    async (email: string, password: string) => {
      try {
        const loggedInUser = await login(email, password);
        if (loggedInUser.role === 'SUPER_ADMIN') {
          navigate('/admin/dashboard');
        } else {
          navigate('/dashboard');
        }
      } catch (err: unknown) {
        toast.error(extractErrorMessage(err, 'Login failed'));
      }
    },
    [login, navigate]
  );

  const handleRegister = useCallback(
    async (data: { email: string; password: string; firstName: string; lastName: string; companyName?: string }) => {
      try {
        const message = await register(data);
        toast.success(message || 'Check your email to verify your account');
        navigate('/verify-email-sent');
      } catch (err: unknown) {
        toast.error(extractErrorMessage(err, 'Registration failed'));
      }
    },
    [register, navigate]
  );

  const handleLogout = useCallback(() => {
    logout();
    navigate('/login');
    toast.success('Logged out');
  }, [logout, navigate]);

  return {
    user,
    token,
    isLoading,
    isAuthenticated: !!token,
    handleLogin,
    handleRegister,
    handleLogout,
  };
}
