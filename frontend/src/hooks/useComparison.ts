/**
 * Custom hook for quarter comparison functionality
 */

import { useState, useMemo, useCallback } from 'react';
import { getQuarterOptions, getCurrentQuarter } from '../components/QuarterSelector';
import {
  QuarterMetrics,
  ComparisonMetric,
  metricPolarity,
  calculateChange,
} from '../types/comparison';

interface UseComparisonOptions {
  defaultBaseQuarter?: string;
  defaultCompareQuarter?: string;
  defaultEnabled?: boolean;
}

interface UseComparisonReturn {
  // State
  baseQuarter: string;
  compareQuarter: string;
  comparisonEnabled: boolean;
  baseLabel: string;
  compareLabel: string;

  // Actions
  setBaseQuarter: (quarter: string) => void;
  setCompareQuarter: (quarter: string) => void;
  setComparisonEnabled: (enabled: boolean) => void;
  swapQuarters: () => void;
  resetToDefaults: () => void;

  // Utilities
  formatQuarterLabel: (quarter: string) => string;
  getQuarterOptions: () => ReturnType<typeof getQuarterOptions>;
}

export function useComparison(options: UseComparisonOptions = {}): UseComparisonReturn {
  const currentQuarter = getCurrentQuarter();
  const quarterOptions = getQuarterOptions();

  // Find the previous quarter
  const currentIndex = quarterOptions.findIndex(q => q.value === currentQuarter);
  const previousQuarter = quarterOptions[currentIndex + 1]?.value || quarterOptions[1]?.value || currentQuarter;

  const {
    defaultBaseQuarter = currentQuarter,
    defaultCompareQuarter = previousQuarter,
    defaultEnabled = false,
  } = options;

  const [baseQuarter, setBaseQuarter] = useState(defaultBaseQuarter);
  const [compareQuarter, setCompareQuarter] = useState(defaultCompareQuarter);
  const [comparisonEnabled, setComparisonEnabled] = useState(defaultEnabled);

  const swapQuarters = useCallback(() => {
    const temp = baseQuarter;
    setBaseQuarter(compareQuarter);
    setCompareQuarter(temp);
  }, [baseQuarter, compareQuarter]);

  const resetToDefaults = useCallback(() => {
    setBaseQuarter(defaultBaseQuarter);
    setCompareQuarter(defaultCompareQuarter);
    setComparisonEnabled(false);
  }, [defaultBaseQuarter, defaultCompareQuarter]);

  const formatQuarterLabel = useCallback((quarter: string): string => {
    const match = quarter.match(/(\d{4})-Q(\d)/);
    if (match) {
      return `Q${match[2]} ${match[1]}`;
    }
    return quarter;
  }, []);

  const baseLabel = useMemo(() => formatQuarterLabel(baseQuarter), [baseQuarter, formatQuarterLabel]);
  const compareLabel = useMemo(() => formatQuarterLabel(compareQuarter), [compareQuarter, formatQuarterLabel]);

  return {
    baseQuarter,
    compareQuarter,
    comparisonEnabled,
    baseLabel,
    compareLabel,
    setBaseQuarter,
    setCompareQuarter,
    setComparisonEnabled,
    swapQuarters,
    resetToDefaults,
    formatQuarterLabel,
    getQuarterOptions: () => quarterOptions,
  };
}

/**
 * Generate comparison metrics from two sets of quarter data
 */
export function generateComparisonMetrics(
  baseData: Partial<QuarterMetrics>,
  compareData: Partial<QuarterMetrics>
): ComparisonMetric[] {
  const metricDefinitions: {
    key: keyof QuarterMetrics;
    label: string;
    format?: 'number' | 'percent';
  }[] = [
    { key: 'openBugs', label: 'Open Bugs' },
    { key: 'criticalBugs', label: 'Critical Bugs' },
    { key: 'automationCoverage', label: 'Automation', format: 'percent' },
    { key: 'passRate', label: 'Pass Rate', format: 'percent' },
    { key: 'prsMerged', label: 'PRs Merged' },
    { key: 'prsOpened', label: 'PRs Opened' },
    { key: 'flakyTests', label: 'Flaky Tests' },
    { key: 'storyPointsCompleted', label: 'Story Points' },
    { key: 'avgVelocity', label: 'Avg Velocity' },
    { key: 'totalReviews', label: 'Total Reviews' },
    { key: 'humanReviews', label: 'Human Reviews' },
    { key: 'aiReviews', label: 'AI Reviews' },
  ];

  return metricDefinitions
    .filter(def => baseData[def.key] !== undefined && compareData[def.key] !== undefined)
    .map(def => {
      const currentValue = baseData[def.key] as number;
      const previousValue = compareData[def.key] as number;
      const { change, changePercent, trend } = calculateChange(currentValue, previousValue);
      const polarity = metricPolarity[def.key] || 'positive';
      const isPositive = polarity === 'positive'
        ? trend === 'up' || trend === 'neutral'
        : trend === 'down' || trend === 'neutral';

      return {
        label: def.label,
        currentValue,
        previousValue,
        change,
        changePercent,
        trend,
        isPositive,
        format: def.format,
      };
    });
}

/**
 * Calculate summary statistics from comparison metrics
 */
export function calculateComparisonSummary(metrics: ComparisonMetric[]) {
  const improvements = metrics.filter(m => m.isPositive && m.trend !== 'neutral').length;
  const regressions = metrics.filter(m => !m.isPositive && m.trend !== 'neutral').length;
  const unchanged = metrics.filter(m => m.trend === 'neutral').length;

  const overallScore = metrics.length > 0
    ? Math.round((improvements / metrics.length) * 100)
    : 0;

  return {
    improvements,
    regressions,
    unchanged,
    total: metrics.length,
    overallScore,
    overallTrend: improvements > regressions ? 'positive' : improvements < regressions ? 'negative' : 'neutral',
  };
}

export default useComparison;
