import { useEffect, useState } from 'react';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

interface SparklinePoint { date: string; count: number; }

interface SparklineProps {
  data: SparklinePoint[];
  colorClass?: string; // stroke color, e.g. 'text-ryze-500' (uses currentColor)
  height?: number;
}

/** Lightweight inline SVG polyline — no chart library dependency. Draws in
 * via stroke-dasharray/dashoffset on mount, skipped entirely (renders at
 * final state immediately) when reduced-motion is on. */
export default function Sparkline({ data, colorClass = 'text-ryze-500', height = 32 }: SparklineProps) {
  const prefersReduced = usePrefersReducedMotion();
  const [drawn, setDrawn] = useState(prefersReduced);

  useEffect(() => {
    if (prefersReduced) { setDrawn(true); return; }
    const raf = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(raf);
  }, [prefersReduced]);

  if (data.length < 2) return null;

  const width = 100;
  const max = Math.max(1, ...data.map((d) => d.count));
  const step = width / (data.length - 1);
  const points = data.map((d, i) => {
    const x = i * step;
    const y = height - (d.count / max) * (height - 4) - 2; // 2px padding top/bottom
    return `${x},${y}`;
  });
  const pathLength = data.length * step * 1.5; // rough estimate, good enough for a dash-draw effect

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`w-full ${colorClass}`}
      style={{ height }}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: pathLength,
          strokeDashoffset: drawn ? 0 : pathLength,
          transition: prefersReduced ? undefined : 'stroke-dashoffset 700ms ease-out',
        }}
      />
    </svg>
  );
}
