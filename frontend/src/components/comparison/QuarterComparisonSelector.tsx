import { useMemo } from 'react';
import { getQuarterOptions } from '../QuarterSelector';
import { colors } from '../../design-system/tokens';

interface QuarterComparisonSelectorProps {
  baseQuarter: string;
  compareQuarter: string;
  onBaseChange: (quarter: string) => void;
  onCompareChange: (quarter: string) => void;
  onSwap: () => void;
  comparisonEnabled: boolean;
  onToggleComparison: (enabled: boolean) => void;
}

export default function QuarterComparisonSelector({
  baseQuarter,
  compareQuarter,
  onBaseChange,
  onCompareChange,
  onSwap,
  comparisonEnabled,
  onToggleComparison,
}: QuarterComparisonSelectorProps) {
  const quarterOptions = useMemo(() => getQuarterOptions(), []);

  return (
    <div className="flex items-center gap-3">
      {/* Toggle Comparison Mode */}
      <button
        onClick={() => onToggleComparison(!comparisonEnabled)}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium
          transition-all duration-200
          ${comparisonEnabled
            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
            : 'bg-slate-800/50 text-slate-400 border border-slate-700/40 hover:bg-slate-700/50'
          }
        `}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
        <span className="hidden sm:inline">Compare</span>
      </button>

      {comparisonEnabled && (
        <>
          <div className="h-6 w-px bg-slate-700/60" />

          {/* Base Quarter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Base</span>
            <select
              value={baseQuarter}
              onChange={(e) => onBaseChange(e.target.value)}
              className="
                bg-slate-800/70 border border-slate-700/50 text-slate-200 text-sm
                rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-indigo-500
                focus:border-indigo-500 outline-none cursor-pointer min-w-[110px]
              "
            >
              {quarterOptions.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.value === compareQuarter}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Swap Button */}
          <button
            onClick={onSwap}
            className="
              p-1.5 rounded-lg text-slate-500 hover:text-slate-300
              hover:bg-slate-700/50 transition-colors
            "
            title="Swap quarters"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
          </button>

          {/* Compare Quarter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">vs</span>
            <select
              value={compareQuarter}
              onChange={(e) => onCompareChange(e.target.value)}
              className="
                bg-slate-800/70 border border-slate-700/50 text-slate-200 text-sm
                rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-indigo-500
                focus:border-indigo-500 outline-none cursor-pointer min-w-[110px]
              "
            >
              {quarterOptions.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.value === baseQuarter}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      {!comparisonEnabled && (
        <>
          <div className="h-6 w-px bg-slate-700/60" />
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <select
              value={baseQuarter}
              onChange={(e) => onBaseChange(e.target.value)}
              className="
                bg-slate-800/70 border border-slate-700/50 text-slate-200 text-sm
                rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-indigo-500
                focus:border-indigo-500 outline-none cursor-pointer min-w-[120px]
              "
            >
              {quarterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </>
      )}
    </div>
  );
}
