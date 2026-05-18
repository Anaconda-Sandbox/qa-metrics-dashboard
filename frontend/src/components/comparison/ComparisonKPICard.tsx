import { useMemo } from 'react';
import TrendIndicator from './TrendIndicator';

// Simple SVG sparkline component
function MiniSparkline({ data, color = '#6366F1' }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const height = 28;
  const width = 80;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={(data.length - 1) / (data.length - 1) * width}
        cy={height - ((data[data.length - 1] - min) / range) * (height - 4) - 2}
        r="3"
        fill={color}
      />
    </svg>
  );
}

interface ComparisonKPICardProps {
  title: string;
  currentValue: number | string;
  previousValue?: number;
  subtitle?: string;
  previousSubtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  polarity?: 'positive' | 'negative';
  color?: 'emerald' | 'rose' | 'amber' | 'indigo' | 'cyan' | 'violet' | 'default';
  loading?: boolean;
  error?: string;
  sparklineData?: number[];
  comparisonMode?: boolean;
  baseLabel?: string;
  compareLabel?: string;
}

const colorConfig = {
  emerald: {
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/8',
    border: 'border-emerald-500/20',
    glow: 'shadow-emerald-500/10',
    spark: '#10B981',
  },
  rose: {
    text: 'text-rose-400',
    bg: 'bg-rose-500/8',
    border: 'border-rose-500/20',
    glow: 'shadow-rose-500/10',
    spark: '#F43F5E',
  },
  amber: {
    text: 'text-amber-400',
    bg: 'bg-amber-500/8',
    border: 'border-amber-500/20',
    glow: 'shadow-amber-500/10',
    spark: '#F59E0B',
  },
  indigo: {
    text: 'text-indigo-400',
    bg: 'bg-indigo-500/8',
    border: 'border-indigo-500/20',
    glow: 'shadow-indigo-500/10',
    spark: '#6366F1',
  },
  cyan: {
    text: 'text-cyan-400',
    bg: 'bg-cyan-500/8',
    border: 'border-cyan-500/20',
    glow: 'shadow-cyan-500/10',
    spark: '#06B6D4',
  },
  violet: {
    text: 'text-violet-400',
    bg: 'bg-violet-500/8',
    border: 'border-violet-500/20',
    glow: 'shadow-violet-500/10',
    spark: '#8B5CF6',
  },
  default: {
    text: 'text-slate-200',
    bg: 'bg-slate-800/50',
    border: 'border-slate-700/40',
    glow: '',
    spark: '#94A3B8',
  },
};

export default function ComparisonKPICard({
  title,
  currentValue,
  previousValue,
  subtitle,
  previousSubtitle,
  trend,
  polarity = 'positive',
  color = 'default',
  loading,
  error,
  sparklineData,
  comparisonMode = false,
  baseLabel,
  compareLabel,
}: ComparisonKPICardProps) {
  const config = colorConfig[color];

  const numericCurrent = typeof currentValue === 'string'
    ? parseFloat(currentValue.replace(/[^0-9.-]/g, ''))
    : currentValue;

  if (loading) {
    return (
      <div className={`rounded-xl ${config.bg} border ${config.border} p-5`}>
        <div className="animate-pulse space-y-3">
          <div className="h-3 bg-slate-700/60 rounded w-2/3" />
          <div className="h-8 bg-slate-700/40 rounded w-1/2" />
          <div className="h-3 bg-slate-700/30 rounded w-3/4" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-rose-500/5 border border-rose-500/20 p-5">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{title}</p>
        <p className="text-sm text-rose-400">{error}</p>
      </div>
    );
  }

  return (
    <div
      className={`
        rounded-xl ${config.bg} border ${config.border} p-5
        transition-all duration-200 hover:shadow-lg ${config.glow}
        hover:scale-[1.02] cursor-default
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          {title}
        </p>
        {previousValue !== undefined && !comparisonMode && (
          <TrendIndicator
            value={numericCurrent}
            previousValue={previousValue}
            polarity={polarity}
            size="sm"
          />
        )}
      </div>

      {/* Main Content */}
      {comparisonMode && previousValue !== undefined ? (
        <div className="space-y-3">
          {/* Current Period */}
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-xs text-slate-500 mr-2">{baseLabel || 'Current'}</span>
              <span className={`text-2xl font-bold tracking-tight ${config.text}`}>
                {currentValue}
              </span>
            </div>
          </div>

          {/* Comparison Period */}
          <div className="flex items-baseline justify-between border-t border-slate-700/30 pt-3">
            <div>
              <span className="text-xs text-slate-500 mr-2">{compareLabel || 'Previous'}</span>
              <span className="text-lg font-semibold text-slate-400">
                {typeof previousValue === 'number' && typeof currentValue === 'string' && currentValue.includes('%')
                  ? `${previousValue}%`
                  : previousValue.toLocaleString()
                }
              </span>
            </div>
            <TrendIndicator
              value={numericCurrent}
              previousValue={previousValue}
              polarity={polarity}
              size="sm"
              showPercentage={true}
            />
          </div>
        </div>
      ) : (
        <>
          {/* Single Value Display */}
          <p className={`text-3xl font-bold tracking-tight ${config.text}`}>
            {currentValue}
          </p>

          {/* Subtitle */}
          {subtitle && (
            <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
          )}
        </>
      )}

      {/* Sparkline */}
      {sparklineData && sparklineData.length > 2 && (
        <div className="mt-4 h-8">
          <MiniSparkline data={sparklineData} color={config.spark} />
        </div>
      )}
    </div>
  );
}
