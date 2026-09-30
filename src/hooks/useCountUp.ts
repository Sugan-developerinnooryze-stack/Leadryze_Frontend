import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

// Matches animate-fade-in-up's cubic-bezier(0.16, 1, 0.3, 1) — a fast-out,
// gentle-settle ease already established as this app's "premium" motion
// curve (tailwind.config.ts), so a KPI count-up feels consistent with
// every other entrance animation, not like a separate animation system.
function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/** Animates from the previous value to `target` over `durationMs`, returning
 * a raw (possibly fractional) number — callers format/round for display
 * (Math.round for whole counts, toFixed(1) for a percentage), so one hook
 * covers both without losing sub-integer precision mid-animation. Skips
 * straight to `target` (no animation at all) when reduced-motion is on or
 * `enabled` is explicitly false — every KPI number gets reduced-motion
 * support "for free" by going through this one hook. */
export function useCountUp(target: number, opts?: { durationMs?: number; enabled?: boolean }): number {
  const prefersReduced = usePrefersReducedMotion();
  const enabled = (opts?.enabled ?? true) && !prefersReduced;
  const durationMs = opts?.durationMs ?? 800;

  const [value, setValue] = useState(enabled ? 0 : target);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }
    const from = fromRef.current;
    if (from === target) return;

    const start = performance.now();
    const animate = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = easeOutExpo(t);
      setValue(from + (target - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        fromRef.current = target;
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, enabled, durationMs]);

  return value;
}
