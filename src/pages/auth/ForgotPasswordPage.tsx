import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../../services/auth.service';
import toast from 'react-hot-toast';
import AuthLayout, { Brand } from '../../components/auth/AuthLayout';

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authService.forgotPassword({ email });
      setSent(true);
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout>
        <div className="w-full max-w-md">
          <div className="rounded-[24px] bg-surface border border-border p-9 shadow-[0_25px_70px_rgba(15,55,70,0.10)] text-center">
            <div className="flex justify-center mb-6">
              <Brand size="md" />
            </div>
            <div className="text-6xl mb-6">📬</div>
            <h2 className="text-2xl font-bold text-text-primary mb-3">Reset link sent</h2>
            <p className="text-text-muted mb-6">
              If <strong>{email}</strong> is registered, you'll receive a password reset link shortly.
            </p>
            <Link to="/login" className="btn-primary inline-block">Back to Sign In</Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-md">
        <div className="rounded-[24px] bg-surface border border-border p-9 shadow-[0_25px_70px_rgba(15,55,70,0.10)]">
          <div className="flex justify-center mb-6">
            <Brand size="md" />
          </div>
          <p className="text-center text-text-muted -mt-3 mb-6">Reset your password</p>
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label className="label" htmlFor="email">Email address</label>
              <input id="email" type="email" className="input" value={email}
                onChange={(e) => setEmail(e.target.value)} required autoComplete="email"
                placeholder="Enter your registered email" />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Sending…' : 'Send Reset Link'}
            </button>
          </form>
          <p className="text-center text-sm text-text-muted mt-5">
            Remember your password?{' '}
            <Link to="/login" className="text-ryze-600 dark:text-ryze-400 hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}
