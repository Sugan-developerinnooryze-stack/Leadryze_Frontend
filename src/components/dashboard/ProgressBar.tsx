import { useEffect, useState } from 'react';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

interface ProgressBarProps {
  /** 0-100, pre-computed by the caller — keeps this component dumb/reusable. */
  value: number;
  colorClass?: string;
  heightClass?: string;
  /** Draws in from 0→value on mount rather than snapping to its final
   * width. Skips the animation (renders at final width immediately) when
   * reduced-motion is on. */
  animateOnMount?: boolean;
}

export default function ProgressBar({
  value, colorClass = 'bg-ryze-600', heightClass = 'h-1.5', animateOnMount = true,
}: ProgressBarProps) {
  const prefersReduced = usePrefersReducedMotion();
  const shouldAnimate = animateOnMount && !prefersReduced;
  const [width, setWidth] = useState(shouldAnimate ? 0 : value);

  useEffect(() => {
    if (!shouldAnimate) { setWidth(value); return; }
    const raf = requestAnimationFrame(() => setWidth(value));
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, shouldAnimate]);

  return (
    <div className={`${heightClass} bg-black/[0.06] dark:bg-white/[0.08] rounded-full overflow-hidden`}>
      <div
        className={`h-full rounded-full ${colorClass} transition-[width] duration-700 ease-out`}
        style={{ width: `${Math.max(0, Math.min(100, width))}%` }}
      />
    </div>
  );
}
