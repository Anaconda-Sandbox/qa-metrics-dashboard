import { useMemo } from "react";

interface Props {
  quarter: string;
  onQuarterChange: (quarter: string) => void;
}

export function getQuarterOptions() {
  const options: { value: string; label: string; isCurrent: boolean }[] = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentQuarter = Math.ceil(currentMonth / 3);
  const currentQuarterValue = `${currentYear}-Q${currentQuarter}`;

  // Add future quarters (2 ahead) + current + past quarters (6 back) = 9 total
  for (let i = -2; i < 7; i++) {
    let q = currentQuarter - i;
    let y = currentYear;
    while (q <= 0) {
      q += 4;
      y -= 1;
    }
    while (q > 4) {
      q -= 4;
      y += 1;
    }
    const value = `${y}-Q${q}`;
    const isCurrent = value === currentQuarterValue;
    const label = isCurrent ? `Q${q} ${y} (Current)` : `Q${q} ${y}`;
    options.push({ value, label, isCurrent });
  }

  return options;
}

export function getCurrentQuarter(): string {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentQuarter = Math.ceil(currentMonth / 3);
  return `${currentYear}-Q${currentQuarter}`;
}

export function getQuarterLabel(quarter: string): string {
  const match = quarter.match(/(\d{4})-Q(\d)/);
  if (match) {
    return `Q${match[2]} ${match[1]}`;
  }
  return quarter;
}

export default function QuarterSelector({ quarter, onQuarterChange }: Props) {
  const quarterOptions = useMemo(() => getQuarterOptions(), []);

  return (
    <div className="flex items-center gap-2">
      <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <select
        value={quarter}
        onChange={(e) => onQuarterChange(e.target.value)}
        className="appearance-none bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-xs font-medium rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] outline-none cursor-pointer min-w-[110px] hover:border-[var(--accent-primary)]/50 transition-colors"
      >
        {quarterOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
