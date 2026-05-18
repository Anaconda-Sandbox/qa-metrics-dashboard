import { useMemo } from 'react';
import { ComparisonMetric, metricPolarity, calculateChange, formatComparisonValue } from '../../types/comparison';

interface ComparisonSummaryCardProps {
  baseLabel: string;
  compareLabel: string;
  metrics: {
    key: string;
    label: string;
    baseValue: number;
    compareValue: number;
    format?: 'number' | 'percent';
  }[];
}

export default function ComparisonSummaryCard({
  baseLabel,
  compareLabel,
  metrics,
}: ComparisonSummaryCardProps) {
  const processedMetrics = useMemo(() => {
    return metrics.map(metric => {
      const { change, changePercent, trend } = calculateChange(metric.baseValue, metric.compareValue);
      const polarity = metricPolarity[metric.key] || 'positive';
      const isPositive = polarity === 'positive' ? trend === 'up' || trend === 'neutral' : trend === 'down' || trend === 'neutral';

      return {
        ...metric,
        change,
        changePercent,
        trend,
        isPositive,
      };
    });
  }, [metrics]);

  const improvements = processedMetrics.filter(m => m.isPositive && m.trend !== 'neutral').length;
  const regressions = processedMetrics.filter(m => !m.isPositive && m.trend !== 'neutral').length;
  const unchanged = processedMetrics.filter(m => m.trend === 'neutral').length;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-900/40 border border-slate-700/30 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">Quarter Comparison</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            {baseLabel} vs {compareLabel}
          </p>
        </div>

        {/* Quick Summary */}
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-400">{improvements}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Improved</p>
          </div>
          <div className="h-8 w-px bg-slate-700/60" />
          <div className="text-center">
            <p className="text-2xl font-bold text-rose-400">{regressions}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Regressed</p>
          </div>
          <div className="h-8 w-px bg-slate-700/60" />
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-400">{unchanged}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Unchanged</p>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {processedMetrics.map((metric) => (
          <div
            key={metric.key}
            className={`
              rounded-xl p-4 border transition-all
              ${metric.isPositive && metric.trend !== 'neutral'
                ? 'bg-emerald-500/5 border-emerald-500/20'
                : metric.trend === 'neutral'
                ? 'bg-slate-800/30 border-slate-700/30'
                : 'bg-rose-500/5 border-rose-500/20'
              }
            `}
          >
            <p className="text-xs text-slate-500 font-medium mb-2">{metric.label}</p>

            {/* Values */}
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-xl font-bold text-slate-100">
                {formatComparisonValue(metric.baseValue, metric.format)}
              </span>
              <span className="text-xs text-slate-500">vs</span>
              <span className="text-sm text-slate-400">
                {formatComparisonValue(metric.compareValue, metric.format)}
              </span>
            </div>

            {/* Change Indicator */}
            {metric.trend !== 'neutral' && (
              <div
                className={`
                  inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded
                  ${metric.isPositive
                    ? 'text-emerald-400 bg-emerald-500/10'
                    : 'text-rose-400 bg-rose-500/10'
                  }
                `}
              >
                <svg
                  className={`w-3 h-3 ${metric.trend === 'up' ? '' : 'rotate-180'}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                </svg>
                <span>
                  {Math.abs(metric.changePercent).toFixed(1)}%
                  {metric.format !== 'percent' && (
                    <span className="text-slate-500 ml-1">
                      ({metric.trend === 'up' ? '+' : ''}{metric.change.toLocaleString()})
                    </span>
                  )}
                </span>
              </div>
            )}

            {metric.trend === 'neutral' && (
              <span className="text-xs text-slate-500">No change</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Executive Summary variant - horizontal layout for hero section
export function ExecutiveComparisonSummary({
  baseLabel,
  compareLabel,
  metrics,
}: ComparisonSummaryCardProps) {
  return (
    <div className="rounded-2xl bg-gradient-to-r from-indigo-500/10 via-slate-900/50 to-cyan-500/10 border border-slate-700/30 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          Executive Summary
        </h3>
        <span className="text-xs text-slate-500">
          {baseLabel} vs {compareLabel}
        </span>
      </div>

      <div className="flex items-center justify-between gap-4 overflow-x-auto pb-2">
        {metrics.slice(0, 6).map((metric) => {
          const { change, changePercent, trend } = calculateChange(metric.baseValue, metric.compareValue);
          const polarity = metricPolarity[metric.key] || 'positive';
          const isPositive = polarity === 'positive' ? trend === 'up' || trend === 'neutral' : trend === 'down' || trend === 'neutral';

          return (
            <div key={metric.key} className="flex-1 min-w-[140px] text-center">
              <p className="text-xs text-slate-500 mb-1">{metric.label}</p>
              <p className="text-2xl font-bold text-slate-100">
                {formatComparisonValue(metric.baseValue, metric.format)}
              </p>
              {trend !== 'neutral' && (
                <p
                  className={`text-xs font-medium mt-1 ${
                    isPositive ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {trend === 'up' ? '+' : ''}{changePercent.toFixed(1)}% from {compareLabel}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
