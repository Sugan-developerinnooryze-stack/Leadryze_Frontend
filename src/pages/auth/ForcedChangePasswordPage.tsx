import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import AuthLayout, { Brand } from '../../components/auth/AuthLayout';
import SecurityTrustStrip from '../../components/auth/SecurityTrustStrip';
import api from '../../services/api';
import { useAuthStore } from '../../stores/auth.store';
import { extractErrorMessage } from '../../utils/errorMessage';
import { motion } from 'framer-motion';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { Lock, ArrowRight } from 'lucide-react';

const INP =
  'w-full h-[52px] rounded-xl pl-11 pr-4 text-[14px] outline-none transition-all ' +
  'bg-surface border border-border text-text-primary placeholder:text-text-muted/70 ' +
  'focus:border-ryze-500 focus:shadow-[0_0_0_3px_rgba(0,158,181,0.12)]';

export default function ForcedChangePasswordPage() {
  const navigate = useNavigate();
  const fetchMe  = useAuthStore((s) => s.fetchMe);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd]         = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [isLoading, setIsLoading]   = useState(false);
  const reducedMotion               = usePrefersReducedMotion();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentPwd || !newPwd || !confirmPwd) { toast.error('All fields are required'); return; }
    if (newPwd.length < 8) { toast.error('New password must be at least 8 characters'); return; }
    if (newPwd !== confirmPwd) { toast.error('New passwords do not match'); return; }

    setIsLoading(true);
    try {
      await api.put('/api/v1/auth/change-password', { currentPassword: currentPwd, newPassword: newPwd });
      // Backend now sets mustChangePassword: false on success — refresh the
      // store's user object so RequireAuth stops redirecting back here.
      await fetchMe();
      toast.success('Password changed');
      navigate('/dashboard');
    } catch (err: unknown) {
      toast.error(extractErrorMessage(err, 'Failed to change password'));
    } finally {
      setIsLoading(false);
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

          <div className="mb-6">
            <h1 className="text-[28px] font-bold tracking-[-0.02em] text-text-primary">Set a new password</h1>
            <p className="text-[14px] mt-1 text-text-muted">For security, you need to set your own password before continuing.</p>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="currentPwd" className="block text-[13px] font-semibold text-text-primary mb-1.5">
                Temporary Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[17px] h-[17px] text-text-muted pointer-events-none" />
                <input
                  id="currentPwd" type="password" required
                  className={INP}
                  placeholder="The password you were emailed"
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label htmlFor="newPwd" className="block text-[13px] font-semibold text-text-primary mb-1.5">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[17px] h-[17px] text-text-muted pointer-events-none" />
                <input
                  id="newPwd" type="password" required minLength={8}
                  className={INP}
                  placeholder="At least 8 characters"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirmPwd" className="block text-[13px] font-semibold text-text-primary mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[17px] h-[17px] text-text-muted pointer-events-none" />
                <input
                  id="confirmPwd" type="password" required minLength={8}
                  className={INP}
                  placeholder="Re-enter your new password"
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                />
              </div>
            </div>

            <motion.button
              whileHover={reducedMotion ? undefined : { y: -1 }}
              whileTap={reducedMotion ? undefined : { y: 0 }}
              type="submit"
              disabled={isLoading}
              className="w-full h-[56px] rounded-xl text-white text-[15px] font-bold flex items-center justify-center gap-2 mt-1 disabled:opacity-60 transition-shadow"
              style={{
                background: 'linear-gradient(90deg, rgb(var(--color-ryze-600)), rgb(var(--color-ryze-400)))',
                boxShadow: '0 10px 24px rgba(0,158,181,0.22)',
              }}
            >
              {isLoading ? 'Saving…' : <>Set Password <ArrowRight className="w-4 h-4" /></>}
            </motion.button>
          </form>
        </div>

        <SecurityTrustStrip />
      </motion.div>
    </AuthLayout>
  );
}
