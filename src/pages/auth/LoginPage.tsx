import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import AuthLayout from '../../components/auth/AuthLayout';
import { ThemeToggle } from '../../components/ui/ThemeToggle';
import { motion } from 'framer-motion';
import {
  Eye, EyeOff, Mail, Lock, ArrowRight,
  ShieldCheck, FileCheck, Clock, LockKeyhole, CheckSquare,
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

// ── reusable dark input class ──────────────────────────────────────────────
const INP =
  'w-full rounded-[11px] py-[0.72rem] text-[0.82rem] outline-none transition-all ' +
  'bg-[rgba(5,8,20,0.65)] border border-[rgba(30,111,255,0.14)] ' +
  'text-[#D8E4F8] placeholder:text-[#2A3F62] ' +
  'focus:border-[rgba(0,200,232,0.45)] focus:bg-[rgba(30,111,255,0.05)] ' +
  'focus:shadow-[0_0_0_3px_rgba(30,111,255,0.09)]';

export default function LoginPage() {
  const { handleLogin, isLoading } = useAuth();
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPwd, setShowPwd]     = useState(false);
  const navigate                  = useNavigate();

  const onSubmit = (e: FormEvent) => { e.preventDefault(); handleLogin(email, password); };

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
              border: '1px solid rgba(30,111,255,0.18)',
              backdropFilter: 'blur(28px)',
              boxShadow:
                '0 0 0 1px rgba(0,200,232,0.06) inset,' +
                '0 30px 70px rgba(0,0,0,0.5),' +
                '0 0 80px rgba(30,111,255,0.07)',
            }}
          >
            {/* Tab switcher — pill style */}
            <div
              className="flex mb-6 p-[3px] rounded-xl"
              style={{
                background: 'rgba(5,8,20,0.65)',
                border: '1px solid rgba(30,111,255,0.1)',
              }}
            >
              {/* Client — ACTIVE */}
              <div
                className="flex-1 flex items-center justify-center gap-1.5 py-[0.55rem] px-3 rounded-[8px] text-[0.72rem] font-bold tracking-[0.03em] uppercase select-none cursor-default"
                style={{
                  background: 'linear-gradient(135deg,rgba(30,111,255,0.18),rgba(0,200,232,0.08))',
                  border: '1px solid rgba(0,200,232,0.22)',
                  color: '#00C8E8',
                  boxShadow: '0 0 18px rgba(30,111,255,0.12)',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                Client Login
              </div>
              {/* Admin — inactive */}
              <button
                type="button"
                onClick={() => navigate('/admin/login')}
                className="flex-1 flex items-center justify-center gap-1.5 py-[0.55rem] px-3 rounded-[8px] text-[0.72rem] font-bold tracking-[0.03em] uppercase transition-colors hover:text-gray-300 border border-transparent"
                style={{ color: '#4E6A96' }}
              >
                <ShieldCheck className="w-[13px] h-[13px]" />
                Admin Login
              </button>
            </div>

            {/* Title */}
            <div className="mb-5">
              <h1 className="text-[1.3rem] font-extrabold tracking-[-0.03em] text-white">
                Welcome Back! <span>👋</span>
              </h1>
              <p className="text-[0.73rem] mt-1 leading-snug" style={{ color: '#4E6A96' }}>
                Sign in to your account to continue
              </p>
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
                    placeholder="Enter your email"
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
                    placeholder="Enter your password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(v => !v)}
                    className="absolute right-[11px] top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: '#2A3F62' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#00C8E8')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#2A3F62')}
                  >
                    {showPwd ? <EyeOff className="w-[15px] h-[15px]" /> : <Eye className="w-[15px] h-[15px]" />}
                  </button>
                </div>
              </div>

              {/* Options */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div className="relative">
                    <input type="checkbox" className="peer sr-only" defaultChecked />
                    <div className="w-4 h-4 rounded border transition-all peer-checked:bg-[rgba(0,200,232,0.15)]"
                      style={{ border: '1px solid rgba(30,111,255,0.3)' }} />
                    <CheckSquare className="absolute top-0 left-0 w-4 h-4 opacity-0 peer-checked:opacity-100 transition-opacity" style={{ color: '#00C8E8' }} />
                  </div>
                  <span className="text-[0.72rem] font-medium" style={{ color: '#4E6A96' }}>Remember me</span>
                </label>
                <Link to="/forgot-password"
                  className="text-[0.72rem] font-semibold transition-colors hover:text-white"
                  style={{ color: '#00C8E8' }}>
                  Forgot password?
                </Link>
              </div>

              {/* Submit */}
              <motion.button
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                type="submit"
                disabled={isLoading}
                className="relative overflow-hidden w-full py-[0.85rem] rounded-[11px] text-[0.82rem] font-bold text-white flex items-center justify-center gap-2 group mt-1 disabled:opacity-60"
                style={{
                  background: 'linear-gradient(135deg,#1E6FFF 0%,#00C8E8 100%)',
                  boxShadow: '0 0 28px rgba(30,111,255,0.4), 0 4px 15px rgba(0,0,0,0.3)',
                }}
              >
                <div className="absolute inset-0 bg-white/15 -translate-y-full group-hover:translate-y-full transition-transform duration-700" />
                {isLoading ? (
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                ) : (
                  <>Sign In <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>
                )}
              </motion.button>
            </form>

            {/* Divider */}
            <div className="mt-5 flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background: 'rgba(30,111,255,0.1)' }} />
              <span className="text-[0.6rem] font-bold uppercase tracking-widest" style={{ color: '#2A3F62' }}>OR</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(30,111,255,0.1)' }} />
            </div>

            {/* Google */}
            <button
              type="button"
              className="mt-4 w-full py-[0.72rem] rounded-[11px] text-[0.82rem] font-medium text-white flex items-center justify-center gap-3 transition-all"
              style={{ background: 'rgba(5,8,20,0.65)', border: '1px solid rgba(30,111,255,0.12)' }}
              onMouseEnter={e => { const t = e.currentTarget; t.style.borderColor = 'rgba(0,200,232,0.25)'; t.style.background = 'rgba(30,111,255,0.06)'; }}
              onMouseLeave={e => { const t = e.currentTarget; t.style.borderColor = 'rgba(30,111,255,0.12)'; t.style.background = 'rgba(5,8,20,0.65)'; }}
            >
              <svg viewBox="0 0 24 24" width="17" height="17">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            {/* Sign up link */}
            <p className="mt-5 text-center text-[0.72rem]" style={{ color: '#4E6A96' }}>
              Don't have an account?{' '}
              <Link to="/register"
                className="font-bold transition-colors hover:text-white"
                style={{ color: '#00C8E8' }}>
                Sign up
              </Link>
            </p>
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
                style={{ background: 'rgba(9,16,32,0.55)', border: '1px solid rgba(30,111,255,0.08)' }}>
                <Icon className="w-4 h-4 mb-1" style={{ color: '#1E6FFF' }} />
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
