import React from 'react';
import { TrendingUp, TrendingDown, HelpCircle, LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface KpiCardProps {
  title: string;
  value?: string | number | null;
  subtitle?: string;
  change?: number | null;
  trendText?: string;
  sampleSize?: string;
  formula?: string;
  icon?: LucideIcon;
  iconBg?: string;
  iconColor?: string;
  tooltip?: string;
  navigateTo?: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subtitle,
  change,
  trendText,
  sampleSize,
  formula,
  icon: Icon,
  iconBg = 'bg-ryze-600/10',
  iconColor = 'text-ryze-600',
  tooltip,
  navigateTo,
}) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (navigateTo) {
      navigate(navigateTo);
    }
  };

  const displayValue =
    value === null || value === undefined
      ? 'N/A'
      : typeof value === 'number'
      ? value.toLocaleString()
      : value;

  const isPositive = (change ?? 0) >= 0;
  const hasValidChange = change !== null && change !== undefined && value !== 'N/A' && value !== null;

  const combinedTooltip = [tooltip, formula ? `Formula: ${formula}` : null].filter(Boolean).join(' • ');

  return (
    <div
      onClick={navigateTo ? handleClick : undefined}
      className={`card transition-all duration-200 relative overflow-hidden ${
        navigateTo ? 'cursor-pointer hover:border-ryze-500/50 hover:shadow-md' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            {title}
          </span>
          {combinedTooltip && (
            <div className="group relative">
              <HelpCircle className="w-3.5 h-3.5 text-text-muted/60 cursor-help" />
              <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-56 p-2 bg-gray-900 text-white text-[11px] rounded-lg shadow-lg z-50 leading-relaxed text-center">
                {combinedTooltip}
              </div>
            </div>
          )}
        </div>
        {Icon && (
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconBg}`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-2">
        <div className={`text-2xl font-bold tracking-tight ${displayValue === 'N/A' ? 'text-text-muted font-semibold text-xl' : 'text-text-primary'}`}>
          {displayValue}
        </div>
        {hasValidChange && (
          <div
            className={`flex items-center text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
              isPositive
                ? 'bg-success-500/15 text-success-700 dark:text-success-400'
                : 'bg-danger-500/15 text-danger-700 dark:text-danger-400'
            }`}
          >
            {isPositive ? (
              <TrendingUp className="w-3 h-3 mr-1" />
            ) : (
              <TrendingDown className="w-3 h-3 mr-1" />
            )}
            <span>
              {isPositive ? '+' : ''}
              {change}%
            </span>
          </div>
        )}
      </div>

      <div className="mt-1 flex items-center justify-between gap-1">
        {(subtitle || trendText) && (
          <p className="text-xs text-text-muted truncate">
            {subtitle || trendText}
          </p>
        )}
        {sampleSize && (
          <span className="text-[10px] font-medium text-text-muted/80 bg-black/[0.04] dark:bg-white/[0.06] px-1.5 py-0.5 rounded ml-auto shrink-0">
            {sampleSize}
          </span>
        )}
      </div>
    </div>
  );
};
