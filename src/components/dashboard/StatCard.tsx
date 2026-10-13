import type { FC, SVGProps } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpIcon, ArrowDownIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/solid';
import { useCountUp } from '../../hooks/useCountUp';
import EntranceCard from './EntranceCard';
import Sparkline from './Sparkline';

type HeroIcon = FC<SVGProps<SVGSVGElement> & { className?: string }>;

export interface StatCardTrend {
  deltaPct: number;
  direction: 'up' | 'down' | 'flat';
}

export type StatCardAccent = 'teal' | 'blue' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'purple';

interface StatCardProps {
  label: string;
  value: number;
  format?: 'number' | 'currency' | 'percent';
  decimals?: number;
  icon: HeroIcon;
  trend?: StatCardTrend | null;
  trendLabel?: string;
  subtitle?: string;
  isEmpty?: boolean;
  emptyLabel?: string;
  isLoading?: boolean;
  delayMs?: number;
  sparklineData?: { date: string; count: number }[];
  to?: string;
  accent?: StatCardAccent;
}

const ACCENT_STYLES: Record<StatCardAccent, { bg: string; icon: string; border: string; glow: string; sparkline: string }> = {
  teal: {
    bg: 'bg-ryze-500/10 dark:bg-ryze-400/15',
    icon: 'text-ryze-600 dark:text-ryze-400',
    border: 'hover:border-ryze-400/50',
    glow: 'from-ryze-500/5',
    sparkline: 'text-ryze-500',
  },
  blue: {
    bg: 'bg-blue-500/10 dark:bg-blue-400/15',
    icon: 'text-blue-600 dark:text-blue-400',
    border: 'hover:border-blue-400/50',
    glow: 'from-blue-500/5',
    sparkline: 'text-blue-500',
  },
  indigo: {
    bg: 'bg-indigo-500/10 dark:bg-indigo-400/15',
    icon: 'text-indigo-600 dark:text-indigo-400',
    border: 'hover:border-indigo-400/50',
    glow: 'from-indigo-500/5',
    sparkline: 'text-indigo-500',
  },
  emerald: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-400/15',
    icon: 'text-emerald-600 dark:text-emerald-400',
    border: 'hover:border-emerald-400/50',
    glow: 'from-emerald-500/5',
    sparkline: 'text-emerald-500',
  },
  amber: {
    bg: 'bg-amber-500/10 dark:bg-amber-400/15',
    icon: 'text-amber-600 dark:text-amber-400',
    border: 'hover:border-amber-400/50',
    glow: 'from-amber-500/5',
    sparkline: 'text-amber-500',
  },
  rose: {
    bg: 'bg-rose-500/10 dark:bg-rose-400/15',
    icon: 'text-rose-600 dark:text-rose-400',
    border: 'hover:border-rose-400/50',
    glow: 'from-rose-500/5',
    sparkline: 'text-rose-500',
  },
  purple: {
    bg: 'bg-purple-500/10 dark:bg-purple-400/15',
    icon: 'text-purple-600 dark:text-purple-400',
    border: 'hover:border-purple-400/50',
    glow: 'from-purple-500/5',
    sparkline: 'text-purple-500',
  },
};

function formatValue(v: number, format: 'number' | 'currency' | 'percent', decimals: number): string {
  if (format === 'currency') return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}`;
  if (format === 'percent') return `${v.toFixed(decimals)}%`;
  return Math.round(v).toLocaleString();
}

export default function StatCard({
  label, value, format = 'number', decimals = format === 'percent' ? 1 : 0,
  icon: Icon, trend, trendLabel, subtitle, isEmpty, emptyLabel, isLoading = false, delayMs = 0, sparklineData,
  to, accent = 'teal',
}: StatCardProps) {
  const animated = useCountUp(value);
  const showSparkline = !isEmpty && sparklineData && sparklineData.length >= 2;
  const theme = ACCENT_STYLES[accent];

  const cardBody = (
    <div className={`relative overflow-hidden bg-surface rounded-2xl border border-border p-5 shadow-sm transition-all duration-200 group ${
      to ? `hover:-translate-y-1 hover:shadow-md cursor-pointer ${theme.border}` : ''
    }`}>
      {/* Subtle gradient glow at card corner */}
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${theme.glow} to-transparent pointer-events-none rounded-bl-full opacity-60`} />

      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl shrink-0 transition-transform duration-200 group-hover:scale-105 ${theme.bg}`}>
            <Icon className={`h-5 w-5 ${theme.icon}`} />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-text-muted uppercase tracking-wider">{label}</p>
            {subtitle && <p className="text-[11px] text-text-muted mt-0.5">{subtitle}</p>}
          </div>
        </div>

        {to && (
          <span className="p-1.5 rounded-lg text-text-muted opacity-0 group-hover:opacity-100 hover:text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all">
            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
          </span>
        )}
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-3 relative z-10">
        <div>
          {isLoading ? (
            <div className="h-8 w-24 bg-black/[0.06] dark:bg-white/[0.08] animate-pulse rounded-lg my-0.5" />
          ) : isEmpty ? (
            <p className="text-sm text-text-muted mt-0.5">{emptyLabel ?? 'No data yet'}</p>
          ) : (
            <p className="text-[28px] sm:text-[32px] leading-tight font-extrabold text-text-primary tracking-tight tabular-nums">
              {formatValue(animated, format, decimals)}
            </p>
          )}
        </div>

        {!isLoading && showSparkline && (
          <div className="w-20 shrink-0">
            <Sparkline data={sparklineData!} colorClass={theme.sparkline} height={30} />
          </div>
        )}
      </div>

      {/* Footer pill / trend info */}
      <div className="mt-3.5 pt-3 border-t border-border/70 flex items-center justify-between text-xs relative z-10">
        {isLoading ? (
          <div className="h-4 w-28 bg-black/[0.05] dark:bg-white/[0.06] animate-pulse rounded-md" />
        ) : !isEmpty && trend ? (
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full font-semibold ${
              trend.direction === 'up'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                : trend.direction === 'down'
                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}>
              {trend.direction === 'up' && <ArrowUpIcon className="h-3 w-3" />}
              {trend.direction === 'down' && <ArrowDownIcon className="h-3 w-3" />}
              <span className="tabular-nums">{Math.abs(trend.deltaPct).toFixed(1)}%</span>
            </span>
            {trendLabel && <span className="text-text-muted truncate">{trendLabel}</span>}
          </div>
        ) : (
          <span className="text-[11px] text-text-muted">Live sync · Active metrics</span>
        )}

        {to && (
          <span className="text-[11px] font-medium text-ryze-600 dark:text-ryze-400 group-hover:underline">
            View &rarr;
          </span>
        )}
      </div>
    </div>
  );

  return (
    <EntranceCard delayMs={delayMs} className="h-full">
      {to ? <Link to={to} className="block h-full">{cardBody}</Link> : cardBody}
    </EntranceCard>
  );
}
