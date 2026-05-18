/**
 * Enhanced Table Component with professional styling
 */

import { ReactNode } from 'react';

interface Column<T> {
  key: string;
  header: string;
  align?: 'left' | 'center' | 'right';
  width?: string;
  render?: (value: unknown, row: T, index: number) => ReactNode;
}

interface EnhancedTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T;
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  compact?: boolean;
  striped?: boolean;
  className?: string;
}

export default function EnhancedTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyField,
  loading,
  emptyMessage = 'No data available',
  onRowClick,
  compact = false,
  striped = true,
  className = '',
}: EnhancedTableProps<T>) {
  if (loading) {
    return (
      <div className={`overflow-hidden rounded-xl border border-slate-700/30 ${className}`}>
        <div className="animate-pulse">
          {/* Header skeleton */}
          <div className="bg-slate-800/50 px-4 py-3 border-b border-slate-700/30">
            <div className="flex gap-4">
              {columns.map((col, i) => (
                <div
                  key={i}
                  className="h-4 bg-slate-700/60 rounded"
                  style={{ width: col.width || '100px' }}
                />
              ))}
            </div>
          </div>
          {/* Row skeletons */}
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="px-4 py-3 border-b border-slate-700/20">
              <div className="flex gap-4">
                {columns.map((col, j) => (
                  <div
                    key={j}
                    className="h-4 bg-slate-800/40 rounded"
                    style={{ width: col.width || '100px' }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className={`rounded-xl border border-slate-700/30 p-8 text-center ${className}`}>
        <p className="text-sm text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  const alignClass = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  const cellPadding = compact ? 'px-3 py-2' : 'px-4 py-3';

  return (
    <div className={`overflow-x-auto rounded-xl border border-slate-700/30 ${className}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-800/50 border-b border-slate-700/40">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`
                  ${cellPadding} font-semibold text-slate-400 uppercase tracking-wider text-xs
                  ${alignClass[col.align || 'left']}
                `}
                style={{ width: col.width }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr
              key={String(row[keyField])}
              onClick={() => onRowClick?.(row)}
              className={`
                border-b border-slate-700/20 transition-colors
                ${onRowClick ? 'cursor-pointer' : ''}
                ${striped && rowIndex % 2 === 1 ? 'bg-slate-800/20' : ''}
                hover:bg-slate-800/40
              `}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`${cellPadding} text-slate-300 ${alignClass[col.align || 'left']}`}
                >
                  {col.render
                    ? col.render(row[col.key], row, rowIndex)
                    : String(row[col.key] ?? '-')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Status badge component for use in tables
export function StatusBadge({
  status,
  variant,
}: {
  status: string;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'default';
}) {
  const colors = {
    success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    warning: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    error: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    info: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    default: 'bg-slate-700/40 text-slate-400 border-slate-600/30',
  };

  return (
    <span
      className={`
        inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border
        ${colors[variant || 'default']}
      `}
    >
      {status}
    </span>
  );
}

// Progress bar for table cells
export function CellProgress({
  value,
  max = 100,
  color = 'indigo',
}: {
  value: number;
  max?: number;
  color?: 'indigo' | 'emerald' | 'amber' | 'rose';
}) {
  const percentage = Math.min((value / max) * 100, 100);

  const barColors = {
    indigo: 'bg-indigo-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColors[color]} rounded-full transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-slate-400 w-10 text-right">{value}%</span>
    </div>
  );
}
