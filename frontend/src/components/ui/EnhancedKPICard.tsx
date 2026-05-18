/**
 * Enhanced KPI Card with professional styling
 * Supports sparklines, trends, and comparison mode
 */

import { ReactNode } from 'react';

interface EnhancedKPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
    label?: string;
  };
  sparklineData?: number[];
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  error?: string;
  className?: string;
}

const variantConfig = {
  default: {
    bg: 'bg-slate-800/40',
    border: 'border-slate-700/40',
    valueColor: 'text-slate-100',
    iconBg: 'bg-slate-700/40',
    iconColor: 'text-slate-400',
  },
  success: {
    bg: 'bg-emerald-500/8',
    border: 'border-emerald-500/25',
    valueColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-400',
  },
  warning: {
    bg: 'bg-amber-500/8',
    border: 'border-amber-500/25',
    valueColor: 'text-amber-400',
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-400',
  },
  error: {
    bg: 'bg-rose-500/8',
    border: 'border-rose-500/25',
    valueColor: 'text-rose-400',
    iconBg: 'bg-rose-500/15',
    iconColor: 'text-rose-400',
  },
  info: {
    bg: 'bg-blue-500/8',
    border: 'border-blue-500/25',
    valueColor: 'text-blue-400',
    iconBg: 'bg-blue-500/15',
    iconColor: 'text-blue-400',
  },
  accent: {
    bg: 'bg-indigo-500/8',
    border: 'border-indigo-500/25',
    valueColor: 'text-indigo-400',
    iconBg: 'bg-indigo-500/15',
    iconColor: 'text-indigo-400',
  },
};

const sizeConfig = {
  sm: {
    padding: 'p-4',
    valueSize: 'text-xl',
    titleSize: 'text-[10px]',
    subtitleSize: 'text-[10px]',
    iconSize: 'w-4 h-4',
  },
  md: {
    padding: 'p-5',
    valueSize: 'text-2xl',
    titleSize: 'text-xs',
    subtitleSize: 'text-[11px]',
    iconSize: 'w-5 h-5',
  },
  lg: {
    padding: 'p-6',
    valueSize: 'text-3xl',
    titleSize: 'text-sm',
    subtitleSize: 'text-xs',
    iconSize: 'w-6 h-6',
  },
};

// Simple inline sparkline using SVG
function MiniSparkline({ data, color = '#6366F1' }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const height = 24;
  const width = 64;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      <circle
        cx={(data.length - 1) / (data.length - 1) * width}
        cy={height - ((data[data.length - 1] - min) / range) * height}
        r="3"
        fill={color}
      />
    </svg>
  );
}

export default function EnhancedKPICard({
  title,
  value,
  subtitle,
  icon,
  trend,
  sparklineData,
  variant = 'default',
  size = 'md',
  loading,
  error,
  className = '',
}: EnhancedKPICardProps) {
  const colors = variantConfig[variant];
  const sizes = sizeConfig[size];

  if (loading) {
    return (
      <div className={`rounded-xl ${colors.bg} border ${colors.border} ${sizes.padding} ${className}`}>
        <div className="animate-pulse space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-3 bg-slate-700/60 rounded w-1/2" />
            {icon && <div className="w-8 h-8 bg-slate-700/40 rounded-lg" />}
          </div>
          <div className="h-8 bg-slate-700/40 rounded w-2/3" />
          <div className="h-3 bg-slate-700/30 rounded w-3/4" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-xl bg-rose-500/5 border border-rose-500/20 ${sizes.padding} ${className}`}>
        <p className={`font-medium text-slate-500 uppercase tracking-wider mb-1 ${sizes.titleSize}`}>{title}</p>
        <p className="text-sm text-rose-400">{error}</p>
      </div>
    );
  }

  return (
    <div
      className={`
        rounded-xl ${colors.bg} border ${colors.border} ${sizes.padding}
        transition-all duration-200 hover:shadow-lg hover:scale-[1.02]
        ${className}
      `}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between mb-2">
        <p className={`font-medium text-slate-500 uppercase tracking-wider ${sizes.titleSize}`}>
          {title}
        </p>
        {icon && (
          <div className={`${colors.iconBg} rounded-lg p-1.5`}>
            <span className={`${colors.iconColor} ${sizes.iconSize} block`}>
              {icon}
            </span>
          </div>
        )}
      </div>

      {/* Value Row */}
      <div className="flex items-end justify-between">
        <div>
          <p className={`font-bold tracking-tight ${sizes.valueSize} ${colors.valueColor}`}>
            {value}
          </p>
          {subtitle && (
            <p className={`text-slate-500 mt-0.5 ${sizes.subtitleSize}`}>
              {subtitle}
            </p>
          )}
        </div>

        {/* Trend or Sparkline */}
        <div className="flex flex-col items-end gap-1">
          {trend && (
            <div
              className={`
                inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded
                ${trend.isPositive
                  ? 'text-emerald-400 bg-emerald-500/10'
                  : 'text-rose-400 bg-rose-500/10'
                }
              `}
            >
              <svg
                className={`w-3 h-3 ${trend.value > 0 ? '' : 'rotate-180'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
              </svg>
              <span>{Math.abs(trend.value).toFixed(1)}%</span>
            </div>
          )}
          {sparklineData && sparklineData.length > 2 && (
            <MiniSparkline
              data={sparklineData}
              color={variant === 'default' ? '#6366F1' : variantConfig[variant].valueColor.replace('text-', '#').replace('-400', '')}
            />
          )}
        </div>
      </div>
    </div>
  );
}
