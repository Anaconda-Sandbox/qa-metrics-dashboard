/**
 * Comparison Dashboard - Enterprise QA Metrics with Quarter Comparison
 *
 * This component demonstrates the comparison feature layout.
 * It can be integrated into the existing UnifiedDashboard or used standalone.
 */

import { useMemo } from 'react';
import {
  QuarterComparisonSelector,
  ComparisonKPICard,
  ComparisonChart,
  ComparisonSummaryCard,
} from './comparison';
import { EnhancedSection } from './ui';
import { useComparison, generateComparisonMetrics } from '../hooks/useComparison';
import {
  useDefectDensity,
  useAutomationCoverage,
  useReportPortalStats,
  usePRStats,
  useFlakyTests,
} from '../hooks/useMetrics';

interface ComparisonDashboardProps {
  project: string | null;
}

export default function ComparisonDashboard({ project }: ComparisonDashboardProps) {
  const {
    baseQuarter,
    compareQuarter,
    comparisonEnabled,
    baseLabel,
    compareLabel,
    setBaseQuarter,
    setCompareQuarter,
    setComparisonEnabled,
    swapQuarters,
  } = useComparison();

  // Fetch data for base quarter
  const { data: baseDensity, isLoading: baseDensityLoading } = useDefectDensity(null, project, baseQuarter);
  const { data: baseCoverage, isLoading: baseCoverageLoading } = useAutomationCoverage(null, project);
  const { data: basePRStats, isLoading: basePRLoading } = usePRStats(null, project, baseQuarter);
  const { data: baseRPStats, isLoading: baseRPLoading } = useReportPortalStats();
  const { data: baseFlaky, isLoading: baseFlakyLoading } = useFlakyTests(10);

  // Fetch data for comparison quarter (only when comparison is enabled)
  const { data: compareDensity } = useDefectDensity(null, project, comparisonEnabled ? compareQuarter : null);
  const { data: comparePRStats } = usePRStats(null, project, comparisonEnabled ? compareQuarter : null);

  // Determine color variant based on metric health
  const getVariant = (value: number, goodThreshold: number, badThreshold: number, inverse = false): 'success' | 'warning' | 'error' | 'default' => {
    if (inverse) {
      if (value <= goodThreshold) return 'success';
      if (value <= badThreshold) return 'warning';
      return 'error';
    }
    if (value >= goodThreshold) return 'success';
    if (value >= badThreshold) return 'warning';
    return 'error';
  };

  // Prepare comparison metrics
  const comparisonMetrics = useMemo(() => {
    if (!comparisonEnabled) return [];

    return [
      {
        key: 'openBugs',
        label: 'Open Bugs',
        baseValue: baseDensity?.open_bugs ?? 0,
        compareValue: compareDensity?.open_bugs ?? 0,
      },
      {
        key: 'criticalBugs',
        label: 'Critical Bugs',
        baseValue: baseDensity?.open_high_priority ?? 0,
        compareValue: compareDensity?.open_high_priority ?? 0,
      },
      {
        key: 'automationCoverage',
        label: 'Automation',
        baseValue: baseCoverage?.coverage_percentage ?? 0,
        compareValue: baseCoverage?.coverage_percentage ?? 0, // Would need historical data
        format: 'percent' as const,
      },
      {
        key: 'passRate',
        label: 'Pass Rate',
        baseValue: baseRPStats?.avg_pass_rate ?? 0,
        compareValue: baseRPStats?.avg_pass_rate ?? 0, // Would need historical data
        format: 'percent' as const,
      },
      {
        key: 'prsMerged',
        label: 'PRs Merged',
        baseValue: basePRStats?.merged_prs_last_30d ?? 0,
        compareValue: comparePRStats?.merged_prs_last_30d ?? 0,
      },
      {
        key: 'prsOpened',
        label: 'PRs Opened',
        baseValue: basePRStats?.total_prs_last_30d ?? 0,
        compareValue: comparePRStats?.total_prs_last_30d ?? 0,
      },
      {
        key: 'flakyTests',
        label: 'Flaky Tests',
        baseValue: baseFlaky?.total ?? 0,
        compareValue: baseFlaky?.total ?? 0, // Would need historical data
      },
    ];
  }, [
    comparisonEnabled,
    baseDensity,
    compareDensity,
    baseCoverage,
    baseRPStats,
    basePRStats,
    comparePRStats,
    baseFlaky,
  ]);

  const isLoading = baseDensityLoading || baseCoverageLoading || basePRLoading || baseRPLoading || baseFlakyLoading;

  return (
    <div className="space-y-6">
      {/* Comparison Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl bg-slate-900/40 border border-slate-700/30">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">QA Metrics Overview</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {comparisonEnabled
              ? `Comparing ${baseLabel} to ${compareLabel}`
              : `Showing data for ${baseLabel}`
            }
          </p>
        </div>
        <QuarterComparisonSelector
          baseQuarter={baseQuarter}
          compareQuarter={compareQuarter}
          onBaseChange={setBaseQuarter}
          onCompareChange={setCompareQuarter}
          onSwap={swapQuarters}
          comparisonEnabled={comparisonEnabled}
          onToggleComparison={setComparisonEnabled}
        />
      </div>

      {/* Comparison Summary (only shown when comparison is enabled) */}
      {comparisonEnabled && comparisonMetrics.length > 0 && (
        <ComparisonSummaryCard
          baseLabel={baseLabel}
          compareLabel={compareLabel}
          metrics={comparisonMetrics}
        />
      )}

      {/* Hero KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <ComparisonKPICard
          title="Open Bugs"
          currentValue={baseDensity?.open_bugs ?? 0}
          previousValue={comparisonEnabled ? (compareDensity?.open_bugs ?? undefined) : undefined}
          subtitle={`${baseDensity?.open_high_priority ?? 0} critical`}
          polarity="negative"
          color={getVariant(baseDensity?.open_bugs ?? 0, 10, 20, true) === 'success' ? 'emerald' : getVariant(baseDensity?.open_bugs ?? 0, 10, 20, true) === 'warning' ? 'amber' : 'rose'}
          loading={isLoading}
          comparisonMode={comparisonEnabled}
          baseLabel={baseLabel}
          compareLabel={compareLabel}
        />

        <ComparisonKPICard
          title="Automation"
          currentValue={`${baseCoverage?.coverage_percentage ?? 0}%`}
          previousValue={comparisonEnabled ? (baseCoverage?.coverage_percentage ?? undefined) : undefined}
          subtitle={`${baseCoverage?.automated_tickets ?? 0}/${baseCoverage?.total_test_tickets ?? 0}`}
          polarity="positive"
          color={getVariant(baseCoverage?.coverage_percentage ?? 0, 70, 50) === 'success' ? 'emerald' : getVariant(baseCoverage?.coverage_percentage ?? 0, 70, 50) === 'warning' ? 'amber' : 'rose'}
          loading={isLoading}
          comparisonMode={comparisonEnabled}
          baseLabel={baseLabel}
          compareLabel={compareLabel}
        />

        <ComparisonKPICard
          title="Pass Rate"
          currentValue={`${baseRPStats?.avg_pass_rate ?? 0}%`}
          previousValue={comparisonEnabled ? (baseRPStats?.avg_pass_rate ?? undefined) : undefined}
          subtitle="Avg last 10 runs"
          polarity="positive"
          color={getVariant(baseRPStats?.avg_pass_rate ?? 0, 90, 75) === 'success' ? 'emerald' : getVariant(baseRPStats?.avg_pass_rate ?? 0, 90, 75) === 'warning' ? 'amber' : 'rose'}
          loading={isLoading}
          comparisonMode={comparisonEnabled}
          baseLabel={baseLabel}
          compareLabel={compareLabel}
        />

        <ComparisonKPICard
          title="PRs Merged"
          currentValue={basePRStats?.merged_prs_last_30d ?? 0}
          previousValue={comparisonEnabled ? (comparePRStats?.merged_prs_last_30d ?? undefined) : undefined}
          subtitle={baseLabel}
          polarity="positive"
          color="indigo"
          loading={isLoading}
          comparisonMode={comparisonEnabled}
          baseLabel={baseLabel}
          compareLabel={compareLabel}
        />

        <ComparisonKPICard
          title="PRs Opened"
          currentValue={basePRStats?.total_prs_last_30d ?? 0}
          previousValue={comparisonEnabled ? (comparePRStats?.total_prs_last_30d ?? undefined) : undefined}
          subtitle={baseLabel}
          polarity="positive"
          color="cyan"
          loading={isLoading}
          comparisonMode={comparisonEnabled}
          baseLabel={baseLabel}
          compareLabel={compareLabel}
        />

        <ComparisonKPICard
          title="Flaky Tests"
          currentValue={baseFlaky?.total ?? 0}
          previousValue={comparisonEnabled ? (baseFlaky?.total ?? undefined) : undefined}
          subtitle="Needs attention"
          polarity="negative"
          color={getVariant(baseFlaky?.total ?? 0, 2, 5, true) === 'success' ? 'emerald' : getVariant(baseFlaky?.total ?? 0, 2, 5, true) === 'warning' ? 'amber' : 'rose'}
          loading={isLoading}
          comparisonMode={comparisonEnabled}
          baseLabel={baseLabel}
          compareLabel={compareLabel}
        />
      </div>

      {/* Example: Comparison Chart Section */}
      {comparisonEnabled && (
        <EnhancedSection
          title="Quarter-over-Quarter Trends"
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
          badge="Comparison"
          badgeVariant="default"
          collapsible={false}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ComparisonChart
              title="Bug Trends"
              subtitle="Open bugs by week"
              type="bar"
              baseKey="current"
              compareKey="previous"
              baseLabel={baseLabel}
              compareLabel={compareLabel}
              comparisonMode={true}
              data={[
                { name: 'W1', current: 12, previous: 15 },
                { name: 'W2', current: 10, previous: 14 },
                { name: 'W3', current: 8, previous: 12 },
                { name: 'W4', current: 11, previous: 13 },
                { name: 'W5', current: 9, previous: 11 },
                { name: 'W6', current: 7, previous: 10 },
              ]}
            />

            <ComparisonChart
              title="PR Velocity"
              subtitle="PRs merged per week"
              type="line"
              baseKey="current"
              compareKey="previous"
              baseLabel={baseLabel}
              compareLabel={compareLabel}
              comparisonMode={true}
              data={[
                { name: 'W1', current: 8, previous: 6 },
                { name: 'W2', current: 12, previous: 8 },
                { name: 'W3', current: 10, previous: 7 },
                { name: 'W4', current: 15, previous: 9 },
                { name: 'W5', current: 14, previous: 10 },
                { name: 'W6', current: 18, previous: 11 },
              ]}
            />
          </div>
        </EnhancedSection>
      )}

      {/* Placeholder for additional sections */}
      <div className="text-center py-8 text-slate-500 text-sm">
        Additional dashboard sections (Story Points, Quality Metrics, Team Activity, etc.)
        would be rendered here using the enhanced components.
      </div>
    </div>
  );
}
