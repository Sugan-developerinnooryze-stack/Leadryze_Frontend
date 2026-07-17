import { useEffect, useRef, useState } from 'react';
import { LinkIcon, EnvelopeIcon, PhoneIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

interface ShareMenuButtonProps {
  copyLabel: string; // 'Copy Link' | 'Generating…' | 'Copied!'
  copying:   boolean;
  onCopyLink:  () => void;
  onEmail:     () => void;
  onWhatsApp:  () => void;
  // Email/WhatsApp send real customer contact details into the compose form.
  // Roles without "view customer PII" permission only see masked contact data
  // app-wide, so those options are hidden for them — Copy Link still works,
  // since it never exposes the customer's real email/phone.
  showContactShare?: boolean;
}

/** Toolbar "Share" dropdown reused across Quotation/Invoice/Contract/Workorder view pages. */
export default function ShareMenuButton({ copyLabel, copying, onCopyLink, onEmail, onWhatsApp, showContactShare = true }: ShareMenuButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const item = (Icon: typeof LinkIcon, label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={() => { setOpen(false); onClick(); }}
      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
    >
      <Icon className="h-4 w-4 text-gray-400" /> {label}
    </button>
  );

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={copying}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 disabled:opacity-60"
      >
        <LinkIcon className="h-4 w-4" />Share<ChevronDownIcon className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-gray-200 z-20 overflow-hidden py-1">
          {item(LinkIcon, copyLabel, onCopyLink)}
          {showContactShare && item(EnvelopeIcon, 'Email PDF', onEmail)}
          {showContactShare && item(PhoneIcon, 'WhatsApp', onWhatsApp)}
        </div>
      )}
    </div>
  );
}
