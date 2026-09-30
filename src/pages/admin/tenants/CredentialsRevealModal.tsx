import { useState } from 'react';
import { ClipboardDocumentIcon, CheckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

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

/** One-time credential reveal — used after Create Tenant, Approve,
 * Regenerate Tenant Admin Password, and Add User. This screen (plus the
 * credential email) is the only place a Super Admin ever sees the plaintext
 * password; it is never retrievable again afterward. Login needs three
 * pieces of info (Login ID + Email + Password), so all three are shown
 * whenever `email` is provided. `loginId` is the tenant's own Client ID for
 * a Tenant Admin, or that tenant's Client ID with a per-user suffix (e.g.
 * ABCD1234-U001) for anyone else. */
export default function CredentialsRevealModal({
  title, loginId, email, password, emailSent, onClose,
}: {
  title: string;
  loginId: string;
  email?: string;
  password: string;
  emailSent?: boolean;
  onClose: () => void;
}) {
  const input = 'flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary font-mono';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" className="bg-surface-elevated border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-text-primary font-semibold text-base">{title}</h3>
        <p className="text-sm text-text-muted mt-1 mb-4">
          Copy these now — the password won't be shown again after you close this.
        </p>

        {emailSent === false && (
          <div className="flex items-start gap-2 mb-4 px-3 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-400 text-xs">
            <ExclamationTriangleIcon className="h-4 w-4 shrink-0 mt-0.5" />
            <span>The credential email failed to send — copy this password now and share it directly. Use Regenerate Password later to try sending again.</span>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Login ID</label>
            <div className="flex items-center gap-2">
              <input value={loginId} readOnly className={input} />
              <CopyButton value={loginId} />
            </div>
          </div>
          {email && (
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Email</label>
              <div className="flex items-center gap-2">
                <input value={email} readOnly className={input} />
                <CopyButton value={email} />
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Password</label>
            <div className="flex items-center gap-2">
              <input value={password} readOnly className={input} />
              <CopyButton value={password} />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full px-4 py-2.5 rounded-xl bg-ryze-600 text-white text-sm font-medium hover:bg-ryze-700 transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}
