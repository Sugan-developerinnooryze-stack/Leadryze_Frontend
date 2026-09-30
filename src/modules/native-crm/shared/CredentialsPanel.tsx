import { useState, useEffect } from 'react';
import {
  KeyIcon, EyeIcon, EyeSlashIcon, ArrowPathIcon,
  ClipboardDocumentIcon, CheckIcon, LockClosedIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../../../stores/auth.store';
import {
  useAppCredentialsQuery,
  useAppCredentialsUpdate,
  useAppPasswordRegenerate,
  type CredentialEntity,
} from '../queries/app-credentials.queries';

interface CredentialsPanelProps {
  entity: CredentialEntity;      // 'staffs' | 'customers'
  id:     string;                // Mongo _id of the record
  appName: string;               // e.g. "Staff App" / "Customer App"
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors"
      title="Copy"
    >
      {copied ? <CheckIcon className="h-4 w-4 text-success-500" /> : <ClipboardDocumentIcon className="h-4 w-4" />}
    </button>
  );
}

export default function CredentialsPanel({ entity, id, appName }: CredentialsPanelProps) {
  const user    = useAuthStore((s) => s.user);
  const isAdmin = ['SUPER_ADMIN', 'TENANT_ADMIN'].includes(user?.role ?? '');

  const { data: creds, isLoading, error } = useAppCredentialsQuery(entity, isAdmin ? id : '');
  const updateMutation = useAppCredentialsUpdate(entity, id);
  const regenMutation  = useAppPasswordRegenerate(entity, id);

  const [username,     setUsername]     = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message,      setMessage]      = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (creds) {
      setUsername(creds.username);
      setPassword(creds.password);
    }
  }, [creds]);

  if (!isAdmin) {
    return (
      <div className="bg-surface rounded-xl border border-border shadow-sm p-8 text-center text-text-muted">
        <LockClosedIcon className="h-10 w-10 mx-auto mb-2 text-text-muted/70" />
        <p className="text-sm">Only admins can view login credentials.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-surface rounded-xl border border-border shadow-sm p-8 flex justify-center">
        <div className="flex gap-2">{[0, 1, 2].map((i) => (
          <span key={i} className="h-2.5 w-2.5 rounded-full bg-ryze-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}</div>
      </div>
    );
  }

  if (error || !creds) {
    return (
      <div className="bg-surface rounded-xl border border-border shadow-sm p-8 text-center text-text-muted">
        <p className="text-sm">Could not load credentials.</p>
      </div>
    );
  }

  const dirty = username !== creds.username || password !== creds.password;

  const handleSave = async () => {
    setMessage(null);
    try {
      const payload: { username?: string; password?: string } = {};
      if (username !== creds.username) payload.username = username.trim().toLowerCase();
      if (password !== creds.password) payload.password = password;
      await updateMutation.mutateAsync(payload);
      setMessage({ type: 'ok', text: 'Credentials updated successfully.' });
    } catch (err: any) {
      const status = err?.response?.status;
      setMessage({
        type: 'err',
        text: status === 409
          ? 'Username already taken — choose another.'
          : (err?.response?.data?.message ?? 'Update failed.'),
      });
    }
  };

  const handleRegenerate = async () => {
    setMessage(null);
    try {
      const fresh = await regenMutation.mutateAsync();
      setPassword(fresh.password);
      setShowPassword(true);
      setMessage({ type: 'ok', text: 'New password generated.' });
    } catch {
      setMessage({ type: 'err', text: 'Could not regenerate password.' });
    }
  };

  const input = 'w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-ryze-400 focus:border-transparent';

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-black/[0.015] dark:bg-white/[0.02] flex items-center gap-2">
          <KeyIcon className="h-4 w-4 text-text-muted" />
          <h3 className="text-sm font-semibold text-text-primary">{appName} Login Credentials</h3>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Client ID — mandatory, never editable */}
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">
              Client ID <span className="ml-1 text-[10px] font-normal text-text-muted normal-case">(fixed — cannot be changed)</span>
            </label>
            <div className="flex items-center gap-2">
              <input value={creds.clientId} readOnly disabled className={`${input} bg-background text-text-muted font-mono cursor-not-allowed`} />
              <CopyButton value={creds.clientId} />
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Username</label>
            <div className="flex items-center gap-2">
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={`${input} font-mono`}
                placeholder="username"
              />
              <CopyButton value={username} />
            </div>
            <p className="mt-1 text-[11px] text-text-muted">Lowercase letters and digits only, 4–30 characters.</p>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Password</label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${input} font-mono pr-10`}
                  placeholder="password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-primary"
                >
                  {showPassword ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                </button>
              </div>
              <CopyButton value={password} />
            </div>
            <p className="mt-1 text-[11px] text-text-muted">Minimum 6 characters.</p>
          </div>

          {message && (
            <div className={`text-sm px-4 py-2.5 rounded-lg border ${
              message.type === 'ok'
                ? 'bg-success-500/10 border-success-500/20 text-success-700 dark:text-success-500'
                : 'bg-danger-500/10 border-danger-500/20 text-danger-600 dark:text-danger-500'
            }`}>
              {message.text}
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || updateMutation.isPending || username.trim().length < 4 || password.length < 6}
              className="px-5 py-2.5 rounded-xl bg-ryze-600 text-white text-sm font-medium hover:bg-ryze-700 disabled:opacity-50 transition-colors"
            >
              {updateMutation.isPending ? 'Saving…' : 'Save Credentials'}
            </button>
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={regenMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-50 transition-colors"
            >
              <ArrowPathIcon className={`h-4 w-4 ${regenMutation.isPending ? 'animate-spin' : ''}`} />
              Regenerate Password
            </button>
          </div>

          <p className="text-[11px] text-text-muted pt-1">
            {creds.generatedAt && <>Generated: {new Date(creds.generatedAt).toLocaleString()} · </>}
            {creds.lastLoginAt ? `Last app login: ${new Date(creds.lastLoginAt).toLocaleString()}` : 'Never logged in to the app yet'}
          </p>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 rounded-xl px-5 py-4 text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
        <p className="font-semibold mb-1">How the {appName.toLowerCase()} login works</p>
        <p>The user signs in with the <strong>Client ID</strong>, <strong>Username</strong> and <strong>Password</strong> shown above. The Client ID identifies your company and is fixed — only the username and password can be changed here.</p>
      </div>
    </div>
  );
}
