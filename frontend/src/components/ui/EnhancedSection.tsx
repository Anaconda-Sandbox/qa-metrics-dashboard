/**
 * Enhanced Dashboard Section with professional styling
 */

import { useState, ReactNode } from 'react';

interface EnhancedSectionProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  badge?: string | number;
  badgeVariant?: 'default' | 'success' | 'warning' | 'error';
  defaultExpanded?: boolean;
  collapsible?: boolean;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}

const badgeColors = {
  default: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  success: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  warning: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  error: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
};

export default function EnhancedSection({
  title,
  subtitle,
  icon,
  badge,
  badgeVariant = 'default',
  defaultExpanded = true,
  collapsible = true,
  children,
  actions,
  className = '',
}: EnhancedSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const HeaderContent = (
    <div className="flex items-center gap-3">
      {icon && (
        <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
          <span className="text-indigo-400 w-4 h-4 block">{icon}</span>
        </div>
      )}
      <div>
        <h2 className="text-sm font-semibold text-slate-100 uppercase tracking-wider">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        )}
      </div>
      {badge !== undefined && (
        <span
          className={`
            px-2.5 py-0.5 text-[10px] font-semibold rounded-full border
            ${badgeColors[badgeVariant]}
          `}
        >
          {badge}
        </span>
      )}
    </div>
  );

  return (
    <div
      className={`
        rounded-2xl bg-slate-900/40 border border-slate-700/30
        overflow-hidden backdrop-blur-sm
        ${className}
      `}
    >
      {/* Header */}
      {collapsible ? (
        <button
          onClick={() => setExpanded(!expanded)}
          className="
            w-full flex items-center justify-between px-6 py-4
            hover:bg-slate-800/30 transition-colors
          "
        >
          {HeaderContent}
          <div className="flex items-center gap-3">
            {actions && (
              <div onClick={(e) => e.stopPropagation()}>
                {actions}
              </div>
            )}
            <svg
              className={`
                w-5 h-5 text-slate-500 transition-transform duration-200
                ${expanded ? 'rotate-180' : ''}
              `}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>
      ) : (
        <div className="flex items-center justify-between px-6 py-4">
          {HeaderContent}
          {actions && <div>{actions}</div>}
        </div>
      )}

      {/* Content */}
      {expanded && (
        <div className="px-6 pb-6">
          {children}
        </div>
      )}
    </div>
  );
}

// Compact variant for nested sections
export function CompactSection({
  title,
  children,
  className = '',
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl bg-slate-800/30 border border-slate-700/20 p-5 ${className}`}>
      <h3 className="text-sm font-semibold text-slate-200 mb-4">{title}</h3>
      {children}
    </div>
  );
}
