import { useEffect, useState, type ReactNode } from 'react';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

interface EntranceCardProps {
  delayMs?: number;
  className?: string;
  children: ReactNode;
}

/** The shared stagger-entrance wrapper every dashboard card uses — same
 * mount → requestAnimationFrame → flip-visible idiom already proven in
 * SidebarMorePanel.tsx, just generalized with a `delayMs` for staggering
 * siblings (0, 60, 120, 180…). Skips the transition entirely (not just a
 * 0ms duration) when reduced-motion is on, so there's genuinely no motion,
 * not just an instant one. */
export default function EntranceCard({ delayMs = 0, className = '', children }: EntranceCardProps) {
  const prefersReduced = usePrefersReducedMotion();
  const [visible, setVisible] = useState(prefersReduced);

  useEffect(() => {
    if (prefersReduced) { setVisible(true); return; }
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [prefersReduced]);

  if (prefersReduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      className={`transition-all duration-300 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'} ${className}`}
      style={{ transitionDelay: visible ? `${delayMs}ms` : '0ms' }}
    >
      {children}
    </div>
  );
}
