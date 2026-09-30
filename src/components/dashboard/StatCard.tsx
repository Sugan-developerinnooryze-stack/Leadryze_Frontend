import type { FC, SVGProps } from 'react';
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/solid';
import { useCountUp } from '../../hooks/useCountUp';
import EntranceCard from './EntranceCard';
import Sparkline from './Sparkline';

type HeroIcon = FC<SVGProps<SVGSVGElement> & { className?: string }>;

export interface StatCardTrend {
  deltaPct: number;
  direction: 'up' | 'down' | 'flat';
}

interface StatCardProps {
  label: string;
  value: number;
  format?: 'number' | 'currency' | 'percent';
  decimals?: number;
  icon: HeroIcon;
  trend?: StatCardTrend | null;
  trendLabel?: string;
  /** Tenant genuinely has zero records ever (not just zero this period) —
   * shows `emptyLabel` instead of "0" so a brand-new tenant doesn't read as
   * broken. Distinct from a real "0" for the selected period, which stays "0". */
  isEmpty?: boolean;
  emptyLabel?: string;
  delayMs?: number;
  /** Fixed 14-day daily counts, independent of whatever range is selected
   * for `value` — see backend date-range.ts's SPARKLINE_DAYS comment. */
  sparklineData?: { date: string; count: number }[];
}

function formatValue(v: number, format: 'number' | 'currency' | 'percent', decimals: number): string {
  if (format === 'currency') return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}`;
  if (format === 'percent') return `${v.toFixed(decimals)}%`;
  return Math.round(v).toLocaleString();
}

export default function StatCard({
  label, value, format = 'number', decimals = format === 'percent' ? 1 : 0,
  icon: Icon, trend, trendLabel, isEmpty, emptyLabel, delayMs = 0, sparklineData,
}: StatCardProps) {
  const animated = useCountUp(value);
  const showSparkline = !isEmpty && sparklineData && sparklineData.length >= 2;

  return (
    <EntranceCard delayMs={delayMs} className="flex items-center gap-3 px-5 py-4 flex-1 min-w-[180px]">
      <div className="p-2.5 bg-ryze-600/10 rounded-xl shrink-0">
        <Icon className="h-5 w-5 text-ryze-600 dark:text-ryze-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-text-muted">{label}</p>
        {isEmpty ? (
          <p className="text-sm text-text-muted mt-0.5">{emptyLabel ?? 'No data yet'}</p>
        ) : (
          <p className="text-[30px] leading-tight font-bold text-text-primary tracking-tight tabular-nums">
            {formatValue(animated, format, decimals)}
          </p>
        )}
        {!isEmpty && trend && (
          <p className={`text-xs mt-0.5 flex items-center gap-0.5 ${
            trend.direction === 'up' ? 'text-success-600' : trend.direction === 'down' ? 'text-danger-600' : 'text-text-muted'
          }`}>
            {trend.direction === 'up' && <ArrowUpIcon className="h-3 w-3" />}
            {trend.direction === 'down' && <ArrowDownIcon className="h-3 w-3" />}
            <span className="tabular-nums">{Math.abs(trend.deltaPct).toFixed(1)}%</span>
            {trendLabel && <span className="text-text-muted">{trendLabel}</span>}
          </p>
        )}
      </div>
      {showSparkline && (
        <div className="w-16 shrink-0 hidden sm:block">
          <Sparkline data={sparklineData!} colorClass="text-ryze-500" height={28} />
        </div>
      )}
    </EntranceCard>
  );
}
