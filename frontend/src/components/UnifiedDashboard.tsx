import DashboardSection from "./DashboardSection";
import KPICard from "./KPICard";
import DefectDensityChart from "./DefectDensityChart";
import AutomationCoverageChart from "./AutomationCoverageChart";
import PRTrendsChart from "./PRTrendsChart";
import ReportPortalStats from "./ReportPortalStats";
import BugTable from "./BugTable";
import FlakyTestsTable from "./FlakyTestsTable";
import TeamContributions from "./TeamContributions";
import TeamReviewStats from "./TeamReviewStats";
import {
  useDefectDensity,
  useAutomationCoverage,
  useReportPortalStats,
  usePRStats,
  useFlakyTests,
} from "../hooks/useMetrics";

interface Props {
  squad: string | null;
}

export default function UnifiedDashboard({ squad }: Props) {
  const { data: density, isLoading: densityLoading, error: densityError } = useDefectDensity(squad);
  const { data: coverage, isLoading: coverageLoading, error: coverageError } = useAutomationCoverage(squad);
  const { data: rpStats, isLoading: rpLoading, error: rpError } = useReportPortalStats();
  const { data: prStats, isLoading: prLoading, error: prError } = usePRStats(squad);
  const { data: flaky, isLoading: flakyLoading } = useFlakyTests(10);

  const openBugs = density?.open_bugs ?? 0;
  const criticalBugs = density?.open_high_priority ?? 0;
  const coveragePercent = coverage?.coverage_percentage ?? 0;
  const passRate = rpStats?.avg_pass_rate ?? 0;
  const flakyCount = flaky?.total ?? 0;

  return (
    <div className="space-y-6">
      {/* Hero KPIs - Always visible, no collapse */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard
          title="Open Bugs"
          value={openBugs}
          subtitle={`${criticalBugs} critical`}
          color={openBugs > 20 ? "red" : openBugs > 10 ? "yellow" : "green"}
          loading={densityLoading}
          error={densityError ? "Unavailable" : undefined}
        />
        <KPICard
          title="Automation"
          value={`${coveragePercent}%`}
          subtitle={`${coverage?.automated_tickets ?? 0}/${coverage?.total_test_tickets ?? 0}`}
          color={coveragePercent >= 70 ? "green" : coveragePercent >= 50 ? "yellow" : "red"}
          loading={coverageLoading}
          error={coverageError ? "Unavailable" : undefined}
        />
        <KPICard
          title="Pass Rate"
          value={`${passRate}%`}
          subtitle="Avg last 10 runs"
          color={passRate >= 90 ? "green" : passRate >= 75 ? "yellow" : "red"}
          loading={rpLoading}
          error={rpError ? "Unavailable" : undefined}
        />
        <KPICard
          title="PRs Merged"
          value={prStats?.merged_prs_last_30d ?? 0}
          subtitle="Last 30 days"
          color="blue"
          loading={prLoading}
          error={prError ? "Unavailable" : undefined}
        />
        <KPICard
          title="PRs Opened"
          value={prStats?.total_prs_last_30d ?? 0}
          subtitle="Last 30 days"
          color="blue"
          loading={prLoading}
          error={prError ? "Unavailable" : undefined}
        />
        <KPICard
          title="Flaky Tests"
          value={flakyCount}
          subtitle="Needs attention"
          color={flakyCount > 5 ? "red" : flakyCount > 2 ? "yellow" : "green"}
          loading={flakyLoading}
        />
      </div>

      {/* Quality Metrics Section */}
      <DashboardSection
        title="Quality Metrics"
        icon={
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DefectDensityChart squad={squad} />
          <AutomationCoverageChart squad={squad} />
        </div>
      </DashboardSection>

      {/* Team Activity Section */}
      <DashboardSection
        title="Team Activity"
        icon={
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        }
        badge="PRs & Reviews"
      >
        <div className="space-y-6">
          <TeamContributions squad={squad} />
          <PRTrendsChart squad={squad} />
        </div>
      </DashboardSection>

      {/* PR Review Activity Section */}
      <DashboardSection
        title="PR Review Activity"
        icon={
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        }
        badge="Human & AI"
      >
        <TeamReviewStats squad={squad} />
      </DashboardSection>

      {/* Test Results Section */}
      <DashboardSection
        title="Test Execution"
        icon={
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ReportPortalStats />
          <FlakyTestsTable />
        </div>
      </DashboardSection>

      {/* Bug Tracker Section */}
      <DashboardSection
        title="Bug Tracker"
        icon={
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
        badge={openBugs > 0 ? `${openBugs} open` : undefined}
      >
        <BugTable squad={squad} />
      </DashboardSection>
    </div>
  );
}
