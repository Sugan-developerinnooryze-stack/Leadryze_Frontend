import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/auth.service';
import { useAuthStore } from '../../stores/auth.store';
import toast from 'react-hot-toast';
import AuthLayout from '../../components/auth/AuthLayout';
import { ThemeToggle } from '../../components/ui/ThemeToggle';
import { motion } from 'framer-motion';
import {
  Eye, EyeOff, Mail, Lock, ArrowRight,
  ShieldCheck, FileCheck, Clock, LockKeyhole,
} from 'lucide-react';

// Prevents Chrome autofill from painting white over dark inputs
const AUTOFILL_DARK = `
  input:-webkit-autofill,
  input:-webkit-autofill:hover,
  input:-webkit-autofill:focus,
  input:-webkit-autofill:active {
    -webkit-box-shadow: 0 0 0 1000px rgba(5,8,20,0.9) inset !important;
    -webkit-text-fill-color: #D8E4F8 !important;
    caret-color: #D8E4F8;
    transition: background-color 9999s ease-in-out 0s;
  }
`;

// ── reusable dark input class (violet focus ring) ──────────────────────────
const INP =
  'w-full rounded-[11px] py-[0.72rem] text-[0.82rem] outline-none transition-all ' +
  'bg-[rgba(5,8,20,0.65)] border border-[rgba(107,63,232,0.18)] ' +
  'text-[#D8E4F8] placeholder:text-[#2A3F62] ' +
  'focus:border-[rgba(107,63,232,0.5)] focus:bg-[rgba(107,63,232,0.05)] ' +
  'focus:shadow-[0_0_0_3px_rgba(107,63,232,0.1)]';

export default function AdminLoginPage() {
  const navigate              = useNavigate();
  const [email, setEmail]     = useState('');
  const [password, setPass]   = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

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
    <>
      <style>{AUTOFILL_DARK}</style>
      <div className="absolute top-6 right-6 z-50"><ThemeToggle /></div>

      <AuthLayout>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="w-full max-w-[390px]"
        >
          {/* ── Card ──────────────────────────────────────────────────────── */}
          <div
            className="rounded-[22px] p-7"
            style={{
              background: 'rgba(9,16,32,0.82)',
              border: '1px solid rgba(107,63,232,0.22)',
              backdropFilter: 'blur(28px)',
              boxShadow:
                '0 0 0 1px rgba(107,63,232,0.06) inset,' +
                '0 30px 70px rgba(0,0,0,0.5),' +
                '0 0 80px rgba(107,63,232,0.08)',
            }}
          >
            {/* Tab switcher — pill style */}
            <div
              className="flex mb-6 p-[3px] rounded-xl"
              style={{
                background: 'rgba(5,8,20,0.65)',
                border: '1px solid rgba(107,63,232,0.12)',
              }}
            >
              {/* Client — inactive */}
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="flex-1 flex items-center justify-center gap-1.5 py-[0.55rem] px-3 rounded-[8px] text-[0.72rem] font-bold tracking-[0.03em] uppercase transition-colors hover:text-gray-300 border border-transparent"
                style={{ color: '#4E6A96' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                Client Login
              </button>
              {/* Admin — ACTIVE */}
              <div
                className="flex-1 flex items-center justify-center gap-1.5 py-[0.55rem] px-3 rounded-[8px] text-[0.72rem] font-bold tracking-[0.03em] uppercase select-none cursor-default"
                style={{
                  background: 'linear-gradient(135deg,rgba(107,63,232,0.2),rgba(155,125,255,0.08))',
                  border: '1px solid rgba(107,63,232,0.38)',
                  color: '#9B7DFF',
                  boxShadow: '0 0 18px rgba(107,63,232,0.15)',
                }}
              >
                <ShieldCheck className="w-[13px] h-[13px]" />
                Admin Login
              </div>
            </div>

            {/* Restricted access pill */}
            <div
              className="flex items-center gap-1.5 mb-4 w-fit px-[0.6rem] py-[0.22rem] rounded-[6px] text-[0.62rem] font-bold uppercase tracking-[0.08em]"
              style={{
                background: 'rgba(107,63,232,0.1)',
                border: '1px solid rgba(107,63,232,0.22)',
                color: '#9B7DFF',
              }}
            >
              <span className="w-[5px] h-[5px] rounded-full animate-pulse"
                style={{ background: '#9B7DFF', boxShadow: '0 0 5px #9B7DFF' }} />
              Restricted Access Portal
            </div>

            {/* Title */}
            <div className="mb-5">
              <h1 className="text-[1.3rem] font-extrabold tracking-[-0.03em] text-white">Admin Portal</h1>
              <p className="text-[0.73rem] mt-1 leading-snug" style={{ color: '#4E6A96' }}>
                Authorized personnel only.
              </p>
            </div>

            {/* Demo credentials */}
            <div
              className="mb-5 rounded-xl p-4 flex items-center justify-between"
              style={{ background: 'rgba(5,8,20,0.65)', border: '1px solid rgba(107,63,232,0.18)' }}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="text-[0.58rem] font-mono uppercase tracking-widest w-6" style={{ color: '#6B3FE8' }}>USR</span>
                  <code className="text-[0.72rem] font-mono" style={{ color: '#D8E4F8' }}>admin@leadryze.ai</code>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[0.58rem] font-mono uppercase tracking-widest w-6" style={{ color: '#6B3FE8' }}>PWD</span>
                  <code className="text-[0.72rem] font-mono" style={{ color: '#D8E4F8' }}>Admin@123</code>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setEmail('admin@leadryze.ai'); setPass('Admin@123'); }}
                className="text-[0.68rem] px-3 py-1.5 rounded-lg font-bold transition-all"
                style={{ background: 'rgba(107,63,232,0.15)', border: '1px solid rgba(107,63,232,0.3)', color: '#9B7DFF' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(107,63,232,0.28)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(107,63,232,0.15)')}
              >
                Auto-Fill
              </button>
            </div>

            {/* Form */}
            <form onSubmit={onSubmit} className="flex flex-col gap-[0.85rem]">
              {/* Email */}
              <div>
                <label className="block text-[0.62rem] font-bold uppercase tracking-[0.07em] mb-[0.35rem]" style={{ color: '#4E6A96' }}>
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-[13px] top-1/2 -translate-y-1/2 w-[15px] h-[15px] pointer-events-none" style={{ color: '#2A3F62' }} />
                  <input
                    id="email" type="email" required
                    className={`${INP} pl-[2.6rem] pr-[0.85rem]`}
                    placeholder="admin@leadryze.ai"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[0.62rem] font-bold uppercase tracking-[0.07em] mb-[0.35rem]" style={{ color: '#4E6A96' }}>
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-[13px] top-1/2 -translate-y-1/2 w-[15px] h-[15px] pointer-events-none" style={{ color: '#2A3F62' }} />
                  <input
                    id="password"
                    type={showPwd ? 'text' : 'password'}
                    required
                    className={`${INP} pl-[2.6rem] pr-10`}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPass(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(v => !v)}
                    className="absolute right-[11px] top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: '#2A3F62' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#9B7DFF')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#2A3F62')}
                  >
                    {showPwd ? <EyeOff className="w-[15px] h-[15px]" /> : <Eye className="w-[15px] h-[15px]" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <motion.button
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                type="submit"
                disabled={loading}
                className="relative overflow-hidden w-full py-[0.85rem] rounded-[11px] text-[0.82rem] font-bold text-white flex items-center justify-center gap-2 group mt-1 disabled:opacity-60"
                style={{
                  background: 'linear-gradient(135deg,#6B3FE8 0%,#9B7DFF 100%)',
                  boxShadow: '0 0 28px rgba(107,63,232,0.45), 0 4px 15px rgba(0,0,0,0.3)',
                }}
              >
                <div className="absolute inset-0 bg-white/15 -translate-y-full group-hover:translate-y-full transition-transform duration-700" />
                {loading ? (
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                ) : (
                  <>Authenticate <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>
                )}
              </motion.button>
            </form>

            {/* Super admin note */}
            <div className="mt-5 flex items-center justify-center gap-2 text-[0.68rem]" style={{ color: '#4E6A96' }}>
              <ShieldCheck className="w-3.5 h-3.5" style={{ color: '#6B3FE8' }} />
              Super admin access to the platform
            </div>
          </div>

          {/* Security badges */}
          <div className="mt-4 grid grid-cols-4 gap-2">
            {[
              { Icon: LockKeyhole, label: '256-bit\nEncryption' },
              { Icon: ShieldCheck,  label: 'SOC 2\nCompliant' },
              { Icon: FileCheck,    label: 'GDPR\nReady' },
              { Icon: Clock,        label: '99.9%\nUptime' },
            ].map(({ Icon, label }, i) => (
              <div key={i} className="flex flex-col items-center py-3 rounded-xl"
                style={{ background: 'rgba(9,16,32,0.55)', border: '1px solid rgba(107,63,232,0.1)' }}>
                <Icon className="w-4 h-4 mb-1" style={{ color: '#6B3FE8' }} />
                <span className="text-[0.58rem] text-center font-medium whitespace-pre-line leading-tight"
                  style={{ color: '#4E6A96' }}>
                  {label}
                </span>
              </div>
            ))}
          </div>

        </motion.div>
      </AuthLayout>
    </>
  );
}
