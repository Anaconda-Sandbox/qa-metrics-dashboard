import { useMemo } from 'react';
import { colors } from '../../design-system/tokens';

interface TrendIndicatorProps {
  value: number;
  previousValue?: number;
  format?: 'number' | 'percent';
  polarity?: 'positive' | 'negative'; // positive = up is good, negative = down is good
  showArrow?: boolean;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function TrendIndicator({
  value,
  previousValue,
  format = 'number',
  polarity = 'positive',
  showArrow = true,
  showPercentage = true,
  size = 'md',
  className = '',
}: TrendIndicatorProps) {
  const { change, changePercent, trend, isPositive } = useMemo(() => {
    if (previousValue === undefined) {
      return { change: 0, changePercent: 0, trend: 'neutral' as const, isPositive: true };
    }

    const diff = value - previousValue;
    const percent = previousValue !== 0 ? (diff / previousValue) * 100 : 0;
    const trendDirection = diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral';

    // Determine if this trend is positive based on polarity
    let positive = true;
    if (polarity === 'positive') {
      positive = diff >= 0;
    } else {
      positive = diff <= 0;
    }

    return {
      change: diff,
      changePercent: percent,
      trend: trendDirection as 'up' | 'down' | 'neutral',
      isPositive: positive,
    };
  }, [value, previousValue, polarity]);

  const sizeClasses = {
    sm: 'text-xs gap-0.5',
    md: 'text-sm gap-1',
    lg: 'text-base gap-1.5',
  };

  const iconSize = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  if (previousValue === undefined || trend === 'neutral') {
    return (
      <span className={`inline-flex items-center text-slate-500 ${sizeClasses[size]} ${className}`}>
        <svg className={iconSize[size]} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
        <span>No change</span>
      </span>
    );
  }

  const colorClass = isPositive ? 'text-emerald-400' : 'text-rose-400';
  const bgClass = isPositive ? 'bg-emerald-500/10' : 'bg-rose-500/10';

  const formattedChange = format === 'percent'
    ? `${Math.abs(change).toFixed(1)}pp`
    : Math.abs(change).toLocaleString();

  return (
    <span
      className={`
        inline-flex items-center font-medium ${colorClass} ${sizeClasses[size]}
        px-2 py-0.5 rounded-md ${bgClass} ${className}
      `}
    >
      {showArrow && (
        <svg
          className={`${iconSize[size]} ${trend === 'up' ? '' : 'rotate-180'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M5 15l7-7 7 7"
          />
        </svg>
      )}
      {showPercentage ? (
        <span>{Math.abs(changePercent).toFixed(1)}%</span>
      ) : (
        <span>{trend === 'up' ? '+' : '-'}{formattedChange}</span>
      )}
    </span>
  );
}

// Compact inline variant for use in tables/cards
export function TrendBadge({
  trend,
  changePercent,
  isPositive,
}: {
  trend: 'up' | 'down' | 'neutral';
  changePercent: number;
  isPositive: boolean;
}) {
  if (trend === 'neutral') {
    return (
      <span className="inline-flex items-center text-xs text-slate-500 px-1.5 py-0.5 rounded bg-slate-500/10">
        --
      </span>
    );
  }

  const colorClass = isPositive ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10';

  return (
    <span className={`inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded ${colorClass}`}>
      <svg
        className={`w-3 h-3 mr-0.5 ${trend === 'up' ? '' : 'rotate-180'}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
      </svg>
      {Math.abs(changePercent).toFixed(0)}%
    </span>
  );
}
