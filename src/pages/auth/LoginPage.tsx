import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import AuthLayout, { Brand } from '../../components/auth/AuthLayout';
import SecurityTrustStrip from '../../components/auth/SecurityTrustStrip';
import { motion, AnimatePresence } from 'framer-motion';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import {
  Eye, EyeOff, Mail, Lock, ArrowRight, UserRound, ShieldCheck,
} from 'lucide-react';

import type { Variants } from 'framer-motion';

/** Staggered container: children fade+slide in one by one */
const STAGGER: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.25 } },
};
const FIELD_ITEM: Variants = {
  hidden: { opacity: 0, y: 18 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

const INP =
  'w-full h-[52px] rounded-xl pl-11 pr-4 text-[14px] outline-none transition-all ' +
  'bg-surface border border-border text-text-primary placeholder:text-text-muted/70 ' +
  'focus:border-ryze-500 focus:shadow-[0_0_0_3px_rgba(0,158,181,0.12)]';

export default function LoginPage() {
  const { handleLogin, handleClientIdLogin, isLoading } = useAuth();
  const [clientId, setClientId] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const navigate                = useNavigate();
  const reducedMotion           = usePrefersReducedMotion();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    // This one field doubles as either a Login ID (always uppercase hex,
    // e.g. ADFE7895 or ADFE7895-U001 — see auth.service.ts's
    // loginUserByClientId(), which uppercases and only ever matches
    // Tenant.clientId/User.loginId, never an email) or a real email
    // address. Route to the matching backend path instead of always
    // going through the Client-ID-only lookup, which could never
    // succeed for an email no matter how it was cased.
    if (clientId.includes('@')) {
      handleLogin(clientId, password);
    } else {
      handleClientIdLogin(clientId, password);
    }
  };

  return (
    <AuthLayout>
      <motion.div
        initial={reducedMotion ? undefined : { opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[480px]"
      >
        <motion.div
          className="rounded-[24px] bg-surface border border-border p-9 shadow-[0_25px_70px_rgba(15,55,70,0.10)] relative overflow-hidden"
          whileHover={reducedMotion ? undefined : { boxShadow: '0 32px_80px_rgba(0,158,181,0.13)' }}
          transition={{ duration: 0.3 }}
        >
          {/* Subtle animated gradient border shimmer */}
          <motion.div
            aria-hidden
            className="absolute inset-0 rounded-[24px] pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, rgba(0,158,181,0.06) 0%, transparent 50%, rgba(44,191,208,0.06) 100%)',
            }}
            animate={reducedMotion ? undefined : {
              opacity: [0.5, 1, 0.5],
            }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="flex justify-center mb-7"
            initial={reducedMotion ? undefined : { opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <Brand size="md" />
          </motion.div>

          {/* Client / Admin segmented control */}
          <motion.div
            className="flex mb-7 p-1 rounded-[14px] bg-background gap-1"
            initial={reducedMotion ? undefined : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              className="flex-1 h-[54px] flex items-center justify-center gap-2 rounded-xl bg-ryze-600 text-white text-[13px] font-semibold select-none"
              whileHover={reducedMotion ? undefined : { scale: 1.02 }}
              transition={{ duration: 0.15 }}
              style={{ boxShadow: '0 4px 14px rgba(0,158,181,0.30)' }}
            >
              <UserRound className="w-4 h-4" />
              Client Login
            </motion.div>
            <motion.button
              type="button"
              onClick={() => navigate('/admin/login')}
              className="flex-1 h-[54px] flex items-center justify-center gap-2 rounded-xl text-[13px] font-semibold text-text-muted hover:text-text-primary transition-colors"
              whileHover={reducedMotion ? undefined : { backgroundColor: 'rgba(0,158,181,0.06)' }}
            >
              <ShieldCheck className="w-4 h-4" />
              Admin Login
            </motion.button>
          </motion.div>

          <motion.div
            className="mb-6"
            initial={reducedMotion ? undefined : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.38, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1 className="text-[28px] font-bold tracking-[-0.02em] text-text-primary relative inline-block">
              Welcome Back
              {/* Animated accent underline */}
              <motion.span
                aria-hidden
                className="absolute -bottom-1 left-0 h-[3px] rounded-full bg-gradient-to-r from-ryze-600 to-ryze-400"
                initial={reducedMotion ? undefined : { scaleX: 0, originX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.7, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
                style={{ width: '100%', transformOrigin: 'left' }}
              />
            </h1>
            <p className="text-[14px] mt-2 text-text-muted">Sign in to your account to continue your workspace</p>
          </motion.div>

          {/* Staggered form fields */}
          <motion.form
            onSubmit={onSubmit}
            className="flex flex-col gap-4"
            variants={reducedMotion ? undefined : STAGGER}
            initial="hidden"
            animate="show"
          >
            <motion.div variants={reducedMotion ? undefined : FIELD_ITEM}>
              <label htmlFor="clientId" className="block text-[13px] font-semibold text-text-primary mb-1.5">
                Login ID or Email
              </label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-[17px] h-[17px] text-text-muted group-focus-within:text-ryze-600 transition-colors pointer-events-none" />
                <input
                  id="clientId" type="text" required
                  className={INP}
                  placeholder="Enter your login ID or email"
                  value={clientId}
                  // No case transformation while typing — this used to force
                  // .toUpperCase() on every keystroke, which mangled an email
                  // address as soon as its first letter went in (before "@"
                  // even appeared, so it couldn't be detected and skipped)
                  // and broke browser autofill matching in the process. It
                  // was also redundant for a real Login ID: the backend's
                  // loginUserByClientId() already does .trim().toUpperCase()
                  // itself, so a lowercase-typed Login ID authenticates fine
                  // either way.
                  onChange={(e) => setClientId(e.target.value)}
                />
              </div>
            </motion.div>

            <motion.div variants={reducedMotion ? undefined : FIELD_ITEM}>
              <label htmlFor="password" className="block text-[13px] font-semibold text-text-primary mb-1.5">
                Password
              </label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[17px] h-[17px] text-text-muted group-focus-within:text-ryze-600 transition-colors pointer-events-none" />
                <input
                  id="password"
                  type={showPwd ? 'text' : 'password'}
                  required
                  className={`${INP} pr-11`}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <motion.button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-ryze-600 transition-colors"
                  whileHover={reducedMotion ? undefined : { scale: 1.15 }}
                  whileTap={reducedMotion ? undefined : { scale: 0.9 }}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={showPwd ? 'hide' : 'show'}
                      initial={{ opacity: 0, rotate: -10, scale: 0.7 }}
                      animate={{ opacity: 1, rotate: 0, scale: 1 }}
                      exit={{ opacity: 0, rotate: 10, scale: 0.7 }}
                      transition={{ duration: 0.18 }}
                      className="inline-block"
                    >
                      {showPwd ? <EyeOff className="w-[17px] h-[17px]" /> : <Eye className="w-[17px] h-[17px]" />}
                    </motion.span>
                  </AnimatePresence>
                </motion.button>
              </div>
            </motion.div>

            <motion.div
              className="flex items-center justify-between"
              variants={reducedMotion ? undefined : FIELD_ITEM}
            >
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  defaultChecked
                  className="w-4 h-4 rounded accent-ryze-600 cursor-pointer"
                />
                <span className="text-[13px] font-medium text-text-muted">Remember me</span>
              </label>
              <Link to="/forgot-password" className="text-[13px] font-semibold text-ryze-600 dark:text-ryze-400 hover:underline">
                Forgot password?
              </Link>
            </motion.div>

            <motion.div variants={reducedMotion ? undefined : FIELD_ITEM}>
              <motion.button
                whileHover={reducedMotion ? undefined : { y: -2, boxShadow: '0 16px 36px rgba(0,158,181,0.38)' }}
                whileTap={reducedMotion ? undefined : { y: 0, scale: 0.99 }}
                type="submit"
                disabled={isLoading}
                className="w-full h-[56px] rounded-xl text-white text-[15px] font-bold flex items-center justify-center gap-2 mt-1 disabled:opacity-60 relative overflow-hidden"
                style={{
                  background: 'linear-gradient(90deg, rgb(var(--color-ryze-600)), rgb(var(--color-ryze-400)))',
                  boxShadow: '0 10px 24px rgba(0,158,181,0.28)',
                }}
              >
                {/* Shimmer effect */}
                {!isLoading && (
                  <motion.span
                    aria-hidden
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%)',
                      backgroundSize: '200% 100%',
                    }}
                    animate={reducedMotion ? undefined : { backgroundPosition: ['-200% 0', '200% 0'] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', repeatDelay: 1 }}
                  />
                )}
                {isLoading ? (
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <>
                    Sign In
                    <motion.span
                      animate={reducedMotion ? undefined : { x: [0, 4, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <ArrowRight className="w-4 h-4" />
                    </motion.span>
                  </>
                )}
              </motion.button>
            </motion.div>
          </motion.form>

          <motion.div
            className="mt-6 flex items-center gap-3"
            initial={reducedMotion ? undefined : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.85 }}
          >
            <motion.div
              className="flex-1 h-px bg-border"
              initial={reducedMotion ? undefined : { scaleX: 0, originX: 1 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.5, delay: 0.9 }}
            />
            <span className="text-[11px] font-bold uppercase tracking-widest text-text-muted">Or</span>
            <motion.div
              className="flex-1 h-px bg-border"
              initial={reducedMotion ? undefined : { scaleX: 0, originX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.5, delay: 0.9 }}
            />
          </motion.div>

          <motion.button
            type="button"
            className="mt-4 w-full h-[54px] rounded-xl border border-border bg-surface text-[14px] font-medium text-text-primary flex items-center justify-center gap-3 hover:bg-background transition-colors relative overflow-hidden"
            initial={reducedMotion ? undefined : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.95 }}
            whileHover={reducedMotion ? undefined : { borderColor: 'rgba(0,158,181,0.4)', y: -1 }}
            whileTap={reducedMotion ? undefined : { scale: 0.99 }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </motion.button>

          <motion.p
            className="mt-6 text-center text-[13px] text-text-muted"
            initial={reducedMotion ? undefined : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 1.05 }}
          >
            Don't have an account?{' '}
            <Link to="/register" className="font-bold text-ryze-600 dark:text-ryze-400 hover:underline">
              Sign up
            </Link>
          </motion.p>
        </motion.div>

        <SecurityTrustStrip />
      </motion.div>
    </AuthLayout>
  );
}
