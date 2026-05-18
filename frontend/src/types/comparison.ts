/**
 * Types for Quarter Comparison Feature
 */

export interface QuarterPeriod {
  value: string;     // e.g., "2026-Q2"
  label: string;     // e.g., "Q2 2026"
  year: number;
  quarter: number;
  isCurrent: boolean;
}

export interface ComparisonMetric {
  label: string;
  currentValue: number;
  previousValue: number;
  change: number;          // Absolute change
  changePercent: number;   // Percentage change
  trend: 'up' | 'down' | 'neutral';
  isPositive: boolean;     // Is this trend good? (e.g., bugs down = positive)
  format?: 'number' | 'percent' | 'currency';
}

export interface ComparisonConfig {
  baseQuarter: string;       // The quarter to compare FROM
  compareQuarter: string;    // The quarter to compare TO
  mode: 'side-by-side' | 'overlay' | 'delta';
}

export interface QuarterMetrics {
  quarter: string;
  openBugs: number;
  criticalBugs: number;
  automationCoverage: number;
  passRate: number;
  prsMerged: number;
  prsOpened: number;
  flakyTests: number;
  storyPointsCompleted: number;
  avgVelocity: number;
  totalReviews: number;
  humanReviews: number;
  aiReviews: number;
}

export interface ComparisonData {
  base: QuarterMetrics;
  compare: QuarterMetrics;
  metrics: ComparisonMetric[];
}

// Utility functions
export function calculateChange(current: number, previous: number): { change: number; changePercent: number; trend: 'up' | 'down' | 'neutral' } {
  const change = current - previous;
  const changePercent = previous !== 0 ? ((current - previous) / previous) * 100 : 0;
  const trend = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
  return { change, changePercent, trend };
}

export function formatComparisonValue(value: number, format?: 'number' | 'percent' | 'currency'): string {
  switch (format) {
    case 'percent':
      return `${value.toFixed(1)}%`;
    case 'currency':
      return `$${value.toLocaleString()}`;
    default:
      return value.toLocaleString();
  }
}

export function getQuarterFromValue(value: string): QuarterPeriod | null {
  const match = value.match(/(\d{4})-Q(\d)/);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const quarter = parseInt(match[2], 10);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);
  const isCurrent = year === currentYear && quarter === currentQuarter;

  return {
    value,
    label: `Q${quarter} ${year}`,
    year,
    quarter,
    isCurrent,
  };
}

// Determine if a metric's increase is positive or negative
export const metricPolarity: Record<string, 'positive' | 'negative'> = {
  openBugs: 'negative',           // Lower is better
  criticalBugs: 'negative',       // Lower is better
  flakyTests: 'negative',         // Lower is better
  automationCoverage: 'positive', // Higher is better
  passRate: 'positive',           // Higher is better
  prsMerged: 'positive',          // Higher is better
  prsOpened: 'positive',          // Higher is better
  storyPointsCompleted: 'positive', // Higher is better
  avgVelocity: 'positive',        // Higher is better
  totalReviews: 'positive',       // Higher is better
  humanReviews: 'positive',       // Higher is better
  aiReviews: 'positive',          // Higher is better
};
