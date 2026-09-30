import { LockKeyhole, ShieldCheck, FileCheck, Clock } from 'lucide-react';

const ITEMS = [
  { Icon: LockKeyhole, label: '256-bit\nEncryption' },
  { Icon: ShieldCheck,  label: 'SOC 2\nCompliant' },
  { Icon: FileCheck,    label: 'GDPR\nReady' },
  { Icon: Clock,        label: '99.9%\nUptime' },
];

/** Shared by LoginPage/AdminLoginPage/ForcedChangePasswordPage — was
 * duplicated inline in all three before this redesign. */
export default function SecurityTrustStrip() {
  return (
    <div className="mt-4 grid grid-cols-4 gap-2">
      {ITEMS.map(({ Icon, label }) => (
        <div
          key={label}
          className="flex flex-col items-center py-3 rounded-[14px] bg-surface/70 border border-border"
        >
          <Icon className="w-4 h-4 mb-1 text-ryze-600 dark:text-ryze-400" />
          <span className="text-[0.58rem] text-center font-medium whitespace-pre-line leading-tight text-text-muted">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
