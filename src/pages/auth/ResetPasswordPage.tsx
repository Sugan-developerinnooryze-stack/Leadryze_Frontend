import { useState, FormEvent } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { authService } from '../../services/auth.service';
import toast from 'react-hot-toast';

export default function ResetPasswordPage() {
  const [params]              = useSearchParams();
  const navigate              = useNavigate();
  const [password, setPass]   = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const token = params.get('token') || '';
  const email = params.get('email') || '';

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { toast.error('Passwords do not match'); return; }
    if (password.length < 8)  { toast.error('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await authService.resetPassword({ token, email, password });
      toast.success('Password reset! You can now sign in.');
      navigate('/login');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || 'Reset failed. The link may have expired.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!token || !email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-blue-100 px-4">
        <div className="text-center">
          <div className="text-5xl mb-4">❌</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Invalid reset link</h2>
          <Link to="/forgot-password" className="btn-primary inline-block mt-4">Request new link</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-blue-100 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-brand-600">LeadRyze AI</h1>
          <p className="text-gray-500 mt-2">Set your new password</p>
        </div>
        <div className="card">
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label className="label" htmlFor="password">New Password</label>
              <input id="password" type="password" className="input" value={password}
                onChange={(e) => setPass(e.target.value)} required minLength={8}
                placeholder="Min. 8 characters" />
            </div>
            <div>
              <label className="label" htmlFor="confirm">Confirm Password</label>
              <input id="confirm" type="password" className="input" value={confirm}
                onChange={(e) => setConfirm(e.target.value)} required />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Resetting…' : 'Reset Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
