import { useState, ReactNode } from "react";

interface DashboardSectionProps {
  title: string;
  icon?: ReactNode;
  defaultExpanded?: boolean;
  children: ReactNode;
  badge?: string | number;
}

export default function DashboardSection({
  title,
  icon,
  defaultExpanded = true,
  children,
  badge,
}: DashboardSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="rounded-2xl bg-[#0a0e14] border border-[#1e2a3a]/40 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-[#0f1419]/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon && <span className="text-[#6366f1]">{icon}</span>}
          <h2 className="text-sm font-semibold text-[#e2e8f0] uppercase tracking-wider">
            {title}
          </h2>
          {badge !== undefined && (
            <span className="px-2 py-0.5 text-[10px] font-medium bg-[#6366f1]/20 text-[#a5b4fc] rounded-full">
              {badge}
            </span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-[#64748b] transition-transform duration-200 ${
            expanded ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && <div className="px-6 pb-6">{children}</div>}
    </div>
  );
}
