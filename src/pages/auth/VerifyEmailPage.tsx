import { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { authService } from '../../services/auth.service';
import { useAuthStore } from '../../stores/auth.store';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const setUser  = useAuthStore((s) => s);
  const [status, setStatus] = useState<'verifying' | 'success' | 'pending_approval' | 'error'>('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = params.get('token');
    const email = params.get('email');
    if (!token || !email) { setStatus('error'); setMessage('Invalid verification link.'); return; }

    authService.verifyEmail({ token, email })
      .then((res) => {
        // Approval-gated signups (Flow B): the backend confirms verification
        // but does not issue a session — no tokens to store, no dashboard yet.
        if (res.data.data.status === 'pending_approval') {
          setMessage(res.data.data.message || 'Email verified. Your account is awaiting Super Admin approval.');
          setStatus('pending_approval');
          return;
        }

        const { accessToken, refreshToken, user: raw } = res.data.data;
        setUser.login(raw.email, ''); // not ideal — use direct store set
        // Directly update store
        useAuthStore.setState({
          token: accessToken,
          refreshTokenValue: refreshToken,
          user: {
            _id: raw._id,
            email: raw.email,
            firstName: raw.firstName,
            lastName: raw.lastName,
            role: raw.role,
            tenantId: raw.tenantId,
            emailVerified: true,
          },
        });
        setStatus('success');
        setTimeout(() => navigate('/dashboard'), 2000);
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err?.response?.data?.message || 'Verification failed. The link may have expired.');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center">
        {status === 'verifying' && (
          <>
            <div className="text-5xl mb-4 animate-pulse">🔍</div>
            <h2 className="text-xl font-semibold text-text-primary">Verifying your email…</h2>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-text-primary mb-2">Email verified!</h2>
            <p className="text-text-muted">Redirecting you to your dashboard…</p>
          </>
        )}
        {status === 'pending_approval' && (
          <>
            <div className="text-5xl mb-4">⏳</div>
            <h2 className="text-xl font-bold text-text-primary mb-2">Email verified!</h2>
            <p className="text-text-muted mb-6">{message}</p>
            <Link to="/login" className="btn-primary">Back to login</Link>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-5xl mb-4">❌</div>
            <h2 className="text-xl font-bold text-text-primary mb-2">Verification failed</h2>
            <p className="text-text-muted mb-6">{message}</p>
            <Link to="/register" className="btn-primary">Register again</Link>
          </>
        )}
      </div>
    </div>
  );
}
