import { useState } from 'react';
import { ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/outline';

/** Small inline copy affordance for a value that's safe to redisplay
 * permanently (Client ID, email) — never used for a password. */
export function CopyIconButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="p-0.5 rounded text-text-muted hover:text-text-primary hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors"
      title="Copy"
    >
      {copied ? <CheckIcon className="h-3 w-3 text-success-500" /> : <ClipboardDocumentIcon className="h-3 w-3" />}
    </button>
  );
}
