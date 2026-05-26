/**
 * Small (?) icon + hover/focus tooltip for explaining what a metric means.
 *
 * Usage:
 *   <InfoTip>Tooltip text here.</InfoTip>
 *   <InfoTip size="sm" placement="top" align="end">…</InfoTip>
 *
 * Renders a circle-? icon styled to match existing accents. The tooltip
 * box positions itself relative to the icon and inherits the text-xs +
 * normal-case styling so it doesn't pick up uppercase tracking from
 * surrounding section headers / table-th elements.
 */
import { ReactNode } from "react";

type Size = "sm" | "md";
type Placement = "top" | "bottom";
type Align = "start" | "center" | "end";

interface Props {
  children: ReactNode;
  size?: Size;
  placement?: Placement;
  align?: Align;
  width?: number; // px, default 224 (w-56)
}

export default function InfoTip({
  children,
  size = "sm",
  placement = "top",
  align = "center",
  width = 224,
}: Props) {
  const iconSize = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";
  const placementClass =
    placement === "top"
      ? "bottom-full mb-2"
      : "top-full mt-2";
  const alignClass =
    align === "start"
      ? "left-0"
      : align === "end"
      ? "right-0"
      : "left-1/2 -translate-x-1/2";

  return (
    <span
      className="relative inline-flex items-center group/tip"
      tabIndex={0}
      onClick={(e) => e.stopPropagation()}
    >
      <svg
        className={`${iconSize} text-[var(--text-muted)] hover:text-[var(--accent-primary)] cursor-help`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-label="More info"
      >
        <circle cx="12" cy="12" r="10" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4M12 8h.01" />
      </svg>
      <span
        className={`pointer-events-none absolute ${placementClass} ${alignClass} p-2 rounded-md text-[10px] font-normal normal-case tracking-normal bg-[var(--bg-elevated)] border border-[var(--border-emphasis)] text-[var(--text-secondary)] shadow-xl opacity-0 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 transition-opacity z-50`}
        style={{ width }}
      >
        {children}
      </span>
    </span>
  );
}
