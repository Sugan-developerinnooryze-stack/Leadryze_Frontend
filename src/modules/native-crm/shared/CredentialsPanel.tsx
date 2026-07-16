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
      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
      title="Copy"
    >
      {copied ? <CheckIcon className="h-4 w-4 text-emerald-500" /> : <ClipboardDocumentIcon className="h-4 w-4" />}
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
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center text-gray-400">
        <LockClosedIcon className="h-10 w-10 mx-auto mb-2 text-gray-300" />
        <p className="text-sm">Only admins can view login credentials.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 flex justify-center">
        <div className="flex gap-2">{[0, 1, 2].map((i) => (
          <span key={i} className="h-2.5 w-2.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}</div>
      </div>
    );
  }

  if (error || !creds) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center text-gray-400">
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

  const input = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent';

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <KeyIcon className="h-4 w-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-700">{appName} Login Credentials</h3>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Client ID — mandatory, never editable */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Client ID <span className="ml-1 text-[10px] font-normal text-gray-400 normal-case">(fixed — cannot be changed)</span>
            </label>
            <div className="flex items-center gap-2">
              <input value={creds.clientId} readOnly disabled className={`${input} bg-gray-50 text-gray-500 font-mono cursor-not-allowed`} />
              <CopyButton value={creds.clientId} />
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Username</label>
            <div className="flex items-center gap-2">
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={`${input} font-mono`}
                placeholder="username"
              />
              <CopyButton value={username} />
            </div>
            <p className="mt-1 text-[11px] text-gray-400">Lowercase letters and digits only, 4–30 characters.</p>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Password</label>
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
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700"
                >
                  {showPassword ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                </button>
              </div>
              <CopyButton value={password} />
            </div>
            <p className="mt-1 text-[11px] text-gray-400">Minimum 6 characters.</p>
          </div>

          {message && (
            <div className={`text-sm px-4 py-2.5 rounded-lg border ${
              message.type === 'ok'
                ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                : 'bg-red-50 border-red-100 text-red-600'
            }`}>
              {message.text}
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || updateMutation.isPending || username.trim().length < 4 || password.length < 6}
              className="px-5 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {updateMutation.isPending ? 'Saving…' : 'Save Credentials'}
            </button>
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={regenMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <ArrowPathIcon className={`h-4 w-4 ${regenMutation.isPending ? 'animate-spin' : ''}`} />
              Regenerate Password
            </button>
          </div>

          <p className="text-[11px] text-gray-400 pt-1">
            {creds.generatedAt && <>Generated: {new Date(creds.generatedAt).toLocaleString()} · </>}
            {creds.lastLoginAt ? `Last app login: ${new Date(creds.lastLoginAt).toLocaleString()}` : 'Never logged in to the app yet'}
          </p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 text-xs text-blue-700 leading-relaxed">
        <p className="font-semibold mb-1">How the {appName.toLowerCase()} login works</p>
        <p>The user signs in with the <strong>Client ID</strong>, <strong>Username</strong> and <strong>Password</strong> shown above. The Client ID identifies your company and is fixed — only the username and password can be changed here.</p>
      </div>
    </div>
  );
}
