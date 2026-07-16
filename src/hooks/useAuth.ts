import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/auth.store';

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
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Login failed';
        toast.error(msg);
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
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Registration failed';
        toast.error(msg);
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
