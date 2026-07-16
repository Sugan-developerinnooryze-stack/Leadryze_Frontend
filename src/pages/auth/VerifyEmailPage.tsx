import { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { authService } from '../../services/auth.service';
import { useAuthStore } from '../../stores/auth.store';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const setUser  = useAuthStore((s) => s);
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = params.get('token');
    const email = params.get('email');
    if (!token || !email) { setStatus('error'); setMessage('Invalid verification link.'); return; }

    authService.verifyEmail({ token, email })
      .then((res) => {
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-blue-100 px-4">
      <div className="w-full max-w-md text-center">
        {status === 'verifying' && (
          <>
            <div className="text-5xl mb-4 animate-pulse">🔍</div>
            <h2 className="text-xl font-semibold text-gray-700">Verifying your email…</h2>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Email verified!</h2>
            <p className="text-gray-500">Redirecting you to your dashboard…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-5xl mb-4">❌</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Verification failed</h2>
            <p className="text-gray-500 mb-6">{message}</p>
            <Link to="/register" className="btn-primary">Register again</Link>
          </>
        )}
      </div>
    </div>
  );
}
