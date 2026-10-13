import { LockKeyhole, ShieldCheck, FileCheck, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

const ITEMS = [
  { Icon: LockKeyhole, label: '256-bit\nEncryption' },
  { Icon: ShieldCheck,  label: 'SOC 2\nCompliant' },
  { Icon: FileCheck,    label: 'GDPR\nReady' },
  { Icon: Clock,        label: '99.9%\nUptime' },
];

/** Shared by LoginPage/AdminLoginPage/ForcedChangePasswordPage */
export default function SecurityTrustStrip() {
  return (
    <div className="mt-4 grid grid-cols-4 gap-2">
      {ITEMS.map(({ Icon, label }, i) => (
        <motion.div
          key={label}
          className="flex flex-col items-center py-3 rounded-[14px] bg-surface/70 border border-border cursor-default"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 1.1 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
          whileHover={{ scale: 1.05, borderColor: 'rgba(0,158,181,0.3)' }}
        >
          <Icon className="w-4 h-4 mb-1 text-ryze-600 dark:text-ryze-400" />
          <span className="text-[0.58rem] text-center font-medium whitespace-pre-line leading-tight text-text-muted">
            {label}
          </span>
        </motion.div>
      ))}
    </div>
  );
}
