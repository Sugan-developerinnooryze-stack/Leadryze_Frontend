import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/auth.service';
import { useAuthStore } from '../../stores/auth.store';
import toast from 'react-hot-toast';
import AuthLayout, { Brand } from '../../components/auth/AuthLayout';
import SecurityTrustStrip from '../../components/auth/SecurityTrustStrip';
import { motion } from 'framer-motion';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import {
  Eye, EyeOff, Mail, Lock, ArrowRight, UserRound, ShieldCheck,
} from 'lucide-react';

const INP =
  'w-full h-[52px] rounded-xl pl-11 pr-4 text-[14px] outline-none transition-all ' +
  'bg-surface border border-border text-text-primary placeholder:text-text-muted/70 ' +
  'focus:border-ryze-500 focus:shadow-[0_0_0_3px_rgba(0,158,181,0.12)]';

export default function AdminLoginPage() {
  const navigate               = useNavigate();
  const [email, setEmail]      = useState('');
  const [password, setPass]    = useState('');
  const [showPwd, setShowPwd]  = useState(false);
  const [loading, setLoading]  = useState(false);
  const reducedMotion          = usePrefersReducedMotion();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authService.login({ email, password });
      const { accessToken, refreshToken, user: raw } = res.data.data;
      if (raw.role !== 'SUPER_ADMIN') {
        toast.error('Access denied. Super admin only.');
        setLoading(false);
        return;
      }
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
      navigate('/admin/dashboard');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Login failed';
      toast.error(msg);
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <motion.div
        initial={reducedMotion ? undefined : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[480px]"
      >
        <div className="rounded-[24px] bg-surface border border-border p-9 shadow-[0_25px_70px_rgba(15,55,70,0.10)]">
          <div className="flex justify-center mb-7">
            <Brand size="md" />
          </div>

          {/* Client / Admin segmented control */}
          <div className="flex mb-6 p-1 rounded-[14px] bg-background gap-1">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="flex-1 h-[54px] flex items-center justify-center gap-2 rounded-xl text-[13px] font-semibold text-text-muted hover:text-text-primary transition-colors"
            >
              <UserRound className="w-4 h-4" />
              Client Login
            </button>
            <div className="flex-1 h-[54px] flex items-center justify-center gap-2 rounded-xl bg-ryze-700 text-white text-[13px] font-semibold select-none">
              <ShieldCheck className="w-4 h-4" />
              Admin Login
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 mb-4 px-2.5 py-1 rounded-md bg-ryze-700/10 border border-ryze-700/25 text-ryze-700 dark:text-ryze-400 text-[11px] font-bold uppercase tracking-[0.08em]">
            <span className="w-1.5 h-1.5 rounded-full bg-ryze-700 dark:bg-ryze-400" />
            Restricted Access Portal
          </div>

          <div className="mb-5">
            <h1 className="text-[28px] font-bold tracking-[-0.02em] text-text-primary">Admin Portal</h1>
            <p className="text-[14px] mt-1 text-text-muted">Authorized personnel only.</p>
          </div>

          {/* Demo credentials — pre-existing dev/demo convenience, preserved as-is */}
          <div className="mb-6 rounded-xl p-4 flex items-center justify-between gap-3 bg-background border border-border">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-3">
                <span className="text-[9px] font-mono uppercase tracking-widest w-7 shrink-0 text-text-muted">Usr</span>
                <code className="text-[12px] font-mono text-text-primary truncate">admin@leadryze.ai</code>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[9px] font-mono uppercase tracking-widest w-7 shrink-0 text-text-muted">Pwd</span>
                <code className="text-[12px] font-mono text-text-primary truncate">Admin@123</code>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setEmail('admin@leadryze.ai'); setPass('Admin@123'); }}
              className="text-[12px] px-3 py-1.5 rounded-lg font-bold shrink-0 bg-ryze-700/10 border border-ryze-700/25 text-ryze-700 dark:text-ryze-400 hover:bg-ryze-700/20 transition-colors"
            >
              Auto-Fill
            </button>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="email" className="block text-[13px] font-semibold text-text-primary mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-[17px] h-[17px] text-text-muted pointer-events-none" />
                <input
                  id="email" type="email" required
                  className={INP}
                  placeholder="admin@leadryze.ai"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-[13px] font-semibold text-text-primary mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[17px] h-[17px] text-text-muted pointer-events-none" />
                <input
                  id="password"
                  type={showPwd ? 'text' : 'password'}
                  required
                  className={`${INP} pr-11`}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPass(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-ryze-700 dark:hover:text-ryze-400 transition-colors"
                >
                  {showPwd ? <EyeOff className="w-[17px] h-[17px]" /> : <Eye className="w-[17px] h-[17px]" />}
                </button>
              </div>
            </div>

            <motion.button
              whileHover={reducedMotion ? undefined : { y: -1 }}
              whileTap={reducedMotion ? undefined : { y: 0 }}
              type="submit"
              disabled={loading}
              className="w-full h-[56px] rounded-xl text-white text-[15px] font-bold flex items-center justify-center gap-2 mt-1 disabled:opacity-60 transition-shadow"
              style={{
                background: 'linear-gradient(90deg, rgb(var(--color-ryze-700)), rgb(var(--color-ryze-500)))',
                boxShadow: '0 10px 24px rgba(0,128,143,0.25)',
              }}
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <>Authenticate <ArrowRight className="w-4 h-4" /></>
              )}
            </motion.button>
          </form>

          <div className="mt-5 flex items-center justify-center gap-2 text-[12px] text-text-muted">
            <ShieldCheck className="w-3.5 h-3.5 text-ryze-700 dark:text-ryze-400" />
            Super admin access to the platform
          </div>
        </div>

        <SecurityTrustStrip />
      </motion.div>
    </AuthLayout>
  );
}
