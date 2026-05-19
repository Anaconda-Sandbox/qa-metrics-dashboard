import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  Area,
  AreaChart,
  ComposedChart,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import {
  useDefectDensity,
  useAutomationCoverage,
  usePRStats,
  usePRTrends,
  useTeamContributions,
  useReportPortalStats,
  useFlakyTests,
  useOpenBugs,
} from "../hooks/useMetrics";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { API_BASE_URL } from "../config";

// Import existing components
import BugTable from "./BugTable";
import FlakyTestsTable from "./FlakyTestsTable";

const api = axios.create({ baseURL: API_BASE_URL });

// Professional chart tooltip style
const tooltipStyle = {
  contentStyle: {
    backgroundColor: "rgba(15, 20, 25, 0.95)",
    border: "1px solid rgba(71, 85, 105, 0.3)",
    borderRadius: "12px",
    padding: "12px 16px",
    boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
  },
  labelStyle: { color: "#F1F5F9", fontWeight: 600, marginBottom: "8px" },
};

const JIRA_BASE = "https://anaconda.atlassian.net/issues/";

interface Props {
  project: string | null;
  quarter: string;
  compareQuarter: string | null;
  onExitCompare?: () => void;
}

// Hook for story points
function useStoryPoints(project: string | null, quarter: string | null) {
  return useQuery({
    queryKey: ["jira", "story-points", project, quarter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (project) params.append("project", project);
      if (quarter) params.append("quarter", quarter);
      const { data } = await api.get(`/jira/story-points?${params}`);
      return data;
    },
  });
}

// Hook for team review stats
function useTeamReviewStats(project: string | null, quarter: string | null) {
  return useQuery({
    queryKey: ["github", "team-review-stats", project, quarter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (project) params.append("project", project);
      if (quarter) params.append("quarter", quarter);
      const { data } = await api.get(`/github/team-review-stats?${params}`);
      return data;
    },
  });
}

// Trend Arrow Component
function TrendArrow({ value, inverted = false }: { value: number; inverted?: boolean }) {
  if (value === 0 || isNaN(value)) return <span className="text-[var(--text-muted)]">—</span>;

  const isPositive = inverted ? value < 0 : value > 0;
  const color = isPositive ? "var(--success-base)" : "var(--error-base)";
  const arrow = value > 0 ? "+" : "";

  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color }}>
      {isPositive ? (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      ) : (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      )}
      {arrow}{Math.abs(value).toFixed(1)}%
    </span>
  );
}

// Info Tooltip Component
function InfoTooltip({ text }: { text: string }) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-flex">
      <button
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="p-1 rounded-full hover:bg-[var(--bg-surface)] transition-colors"
      >
        <svg className="w-3.5 h-3.5 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
      {isVisible && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs text-[var(--text-secondary)] bg-[var(--bg-overlay)] border border-[var(--border-default)] rounded-lg shadow-xl z-50 w-64 animate-fade-in">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
            <div className="w-2 h-2 bg-[var(--bg-overlay)] border-r border-b border-[var(--border-default)] transform rotate-45" />
          </div>
        </div>
      )}
    </div>
  );
}

// Metric calculation explanations
const METRIC_INFO: Record<string, string> = {
  "Open Bugs": "Count of unresolved bugs in Jira (status ≠ Closed/Done) for selected project and quarter. Critical = High/Highest priority.",
  "Automation": "Percentage of test tickets with 'Automated' or 'automation' labels. Formula: (Automated Tests / Total Test Tickets) × 100",
  "Pass Rate": "Average pass rate from last 10 ReportPortal test runs. Formula: (Passed Tests / Total Tests) × 100",
  "PRs Merged": "Count of pull requests merged by QA team members during the selected quarter.",
  "PRs Opened": "Count of pull requests opened by QA team members during the selected quarter.",
  "Story Points": "Sum of completed story points (Done status) for QA team during the quarter. In Progress shows currently active work.",
  "Reviews": "Total code reviews submitted by QA team. Human reviews exclude bot accounts like GitHub Copilot.",
  "Flaky Tests": "Tests that pass and fail inconsistently across runs. Identified via ReportPortal retries or status changes.",
  "Velocity": "Committed = sprint-planned points. Completed = actually delivered points. Avg Velocity = mean completed points per week.",
  "Defect Trend": "Weekly count of bugs created vs resolved. Healthy trend shows resolved ≥ created over time.",
  "PR Activity": "Weekly PR activity trend. Opened = new PRs submitted. Merged = PRs completed and merged to main.",
  "Review Activity": "Weekly code review submissions by QA team members across all monitored repositories.",
};

// KPI Card with comparison
function KPICard({
  title,
  value,
  previousValue,
  suffix = "",
  description,
  trend,
  trendInverted = false,
  icon,
  color = "primary",
  loading = false,
  infoKey,
}: {
  title: string;
  value: number | string;
  previousValue?: number | string;
  suffix?: string;
  description?: string;
  trend?: number;
  trendInverted?: boolean;
  icon?: React.ReactNode;
  color?: "primary" | "success" | "warning" | "error" | "info";
  loading?: boolean;
  infoKey?: string;
}) {
  const colorMap = {
    primary: { bg: "var(--accent-primary)", subtle: "rgba(99, 102, 241, 0.1)" },
    success: { bg: "var(--success-base)", subtle: "var(--success-subtle)" },
    warning: { bg: "var(--warning-base)", subtle: "var(--warning-subtle)" },
    error: { bg: "var(--error-base)", subtle: "var(--error-subtle)" },
    info: { bg: "var(--info-base)", subtle: "var(--info-subtle)" },
  };

  const colors = colorMap[color];

  if (loading) {
    return (
      <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-5">
        <div className="skeleton h-4 w-20 rounded mb-3" />
        <div className="skeleton h-8 w-16 rounded mb-2" />
        <div className="skeleton h-3 w-24 rounded" />
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-5 transition-all duration-200 hover:border-[var(--border-emphasis)] hover:shadow-lg group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {title}
          </span>
          {infoKey && METRIC_INFO[infoKey] && <InfoTooltip text={METRIC_INFO[infoKey]} />}
        </div>
        {icon && (
          <div className="p-2 rounded-lg transition-colors" style={{ backgroundColor: colors.subtle }}>
            <div style={{ color: colors.bg }}>{icon}</div>
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold tracking-tight" style={{ color: colors.bg }}>
          {value}{suffix}
        </span>
        {trend !== undefined && <TrendArrow value={trend} inverted={trendInverted} />}
      </div>

      {previousValue !== undefined && (
        <div className="mt-2 text-xs text-[var(--text-muted)]">
          Previous: <span className="text-[var(--text-tertiary)]">{previousValue}{suffix}</span>
        </div>
      )}

      {description && <p className="mt-2 text-xs text-[var(--text-muted)]">{description}</p>}
    </div>
  );
}

// Section Header
function SectionHeader({ title, subtitle, action, badge }: { title: string; subtitle?: string; action?: React.ReactNode; badge?: string }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] tracking-tight">{title}</h2>
        {badge && (
          <span className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/20">
            {badge}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {subtitle && <p className="text-sm text-[var(--text-muted)]">{subtitle}</p>}
        {action}
      </div>
    </div>
  );
}

// Card wrapper
function Card({ children, className = "", padding = true }: { children: React.ReactNode; className?: string; padding?: boolean }) {
  return (
    <div className={`rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] ${padding ? "p-6" : ""} ${className}`}>
      {children}
    </div>
  );
}

// Collapsible Section
function Section({ title, badge, children, defaultOpen = true }: { title: string; badge?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="space-y-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between group"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] tracking-tight">{title}</h2>
          {badge && (
            <span className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/20">
              {badge}
            </span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-[var(--text-muted)] transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && <div className="animate-fade-in">{children}</div>}
    </section>
  );
}

// Automation Coverage Chart Colors
const AUTOMATION_COLORS: Record<string, string> = {
  CLI: "var(--chart-1)",
  API: "var(--chart-5)",
  UI: "var(--chart-4)",
  GHA: "var(--chart-3)",
  Other: "var(--text-muted)",
};

export default function ProfessionalDashboard({ project, quarter, compareQuarter, onExitCompare }: Props) {
  const isComparing = !!compareQuarter;

  // Current period data
  const { data: density, isLoading: densityLoading } = useDefectDensity(null, project, quarter);
  const { data: coverage, isLoading: coverageLoading } = useAutomationCoverage(null, project);
  const { data: prStats, isLoading: prLoading } = usePRStats(null, project, quarter);
  const { data: prTrends } = usePRTrends(null, project, quarter);
  const { data: storyPoints, isLoading: storyLoading } = useStoryPoints(project, quarter);
  const { data: reviewStats, isLoading: reviewLoading } = useTeamReviewStats(project, quarter);
  const { data: contributions } = useTeamContributions(null, project, quarter);
  const { data: rpStats, isLoading: rpLoading } = useReportPortalStats();
  const { data: flaky, isLoading: flakyLoading } = useFlakyTests(10);

  // Comparison period data
  const { data: prevDensity } = useDefectDensity(null, project, compareQuarter || undefined);
  const { data: prevPrStats } = usePRStats(null, project, compareQuarter || undefined);
  const { data: prevStoryPoints } = useStoryPoints(project, compareQuarter);
  const { data: prevReviewStats } = useTeamReviewStats(project, compareQuarter);
  const { data: prevPrTrends } = usePRTrends(null, project, compareQuarter || undefined);

  // Calculate trends
  const calculateTrend = (current: number, previous: number | undefined) => {
    if (!previous || previous === 0) return undefined;
    return ((current - previous) / previous) * 100;
  };

  const periodLabel = quarter?.replace("-", " ") || "Current";
  const comparePeriodLabel = compareQuarter?.replace("-", " ") || "";

  // Automation coverage data
  const automationChartData = useMemo(() => {
    if (!coverage?.by_type) return [];
    return Object.entries(coverage.by_type).map(([name, value]) => ({
      name,
      count: value as number,
    }));
  }, [coverage]);

  // Defect density chart data
  const defectTrendData = useMemo(() => {
    if (!density?.weekly_trend) return [];
    return density.weekly_trend.map((w: any) => ({
      week: w.week.replace(/^\d{4}-W/, "W"),
      Created: w.created,
      Resolved: w.resolved,
    }));
  }, [density]);

  // PR trends data
  const mergedTrends = useMemo(() => {
    if (!prTrends?.trends) return [];
    return prTrends.trends.map((t: any, i: number) => ({
      week: t.week.replace(/^\d{4}-W/, "W"),
      Opened: t.opened,
      Merged: t.merged,
      ...(isComparing && prevPrTrends?.trends && {
        "Prev Opened": prevPrTrends.trends[i]?.opened || 0,
        "Prev Merged": prevPrTrends.trends[i]?.merged || 0,
      }),
    })).slice(-12);
  }, [prTrends, prevPrTrends, isComparing]);

  // Review trends data
  const reviewTrendData = useMemo(() => {
    if (!reviewStats?.weekly_trend) return [];
    return reviewStats.weekly_trend.map((t: any, i: number) => ({
      week: t.week.replace(/^\d{4}-W/, "W"),
      Reviews: t.reviewed,
      ...(isComparing && prevReviewStats?.weekly_trend && {
        "Prev Reviews": prevReviewStats.weekly_trend[i]?.reviewed || 0,
      }),
    }));
  }, [reviewStats, prevReviewStats, isComparing]);

  // Velocity data
  const velocityData = useMemo(() => {
    if (!storyPoints?.velocity_trend) return [];
    return storyPoints.velocity_trend.map((v: any, i: number) => ({
      week: v.sprint_name.replace(/^\d{4}-W/, "W"),
      Committed: v.committed_points,
      Completed: v.completed_points,
      ...(isComparing && prevStoryPoints?.velocity_trend && {
        "Prev Completed": prevStoryPoints.velocity_trend[i]?.completed_points || 0,
      }),
    }));
  }, [storyPoints, prevStoryPoints, isComparing]);

  // Handle automation bar click
  const handleAutomationBarClick = (type: string) => {
    const projects = project && project !== "ALL" ? project : "SIR, PKG, AIC, PA, INST, PDA, AIP, CBR, BIG, DESK, TBP, CASH, AQUA, CLOUD, SHP, HUB, CLI";
    let labelFilter = "";
    if (type === "CLI") labelFilter = 'AND labels in ("cli", "CLI", "cli-test", "cli-automation")';
    else if (type === "API") labelFilter = 'AND labels in ("api", "API", "api-test", "api-automation")';
    else if (type === "UI") labelFilter = 'AND labels in ("ui", "UI", "gui", "GUI", "ui-test", "ui-automation")';
    else if (type === "GHA") labelFilter = 'AND labels in ("gha", "GHA", "github-action", "github-actions")';

    const jql = `project in (${projects}) AND issuetype = Test AND labels in ("Automated", "automation", "qa-automation") ${labelFilter} ORDER BY created DESC`;
    window.open(`${JIRA_BASE}?jql=${encodeURIComponent(jql)}`, "_blank");
  };

  const coverageColor = (coverage?.coverage_percentage ?? 0) >= 70 ? "var(--success-base)" : (coverage?.coverage_percentage ?? 0) >= 50 ? "var(--warning-base)" : "var(--error-base)";

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Comparison Banner */}
      {isComparing && (
        <div className="rounded-xl bg-gradient-to-r from-[var(--accent-primary)]/10 to-[var(--accent-secondary)]/10 border border-[var(--accent-primary)]/20 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[var(--accent-primary)]/20">
                <svg className="w-5 h-5 text-[var(--accent-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Comparing <span className="text-[var(--accent-primary)]">{periodLabel}</span> vs{" "}
                  <span className="text-[var(--text-tertiary)]">{comparePeriodLabel}</span>
                </p>
                <p className="text-xs text-[var(--text-muted)]">Trends show percentage change from previous period</p>
              </div>
            </div>
            {onExitCompare && (
              <button
                onClick={onExitCompare}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-overlay)] hover:border-[var(--border-default)] transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Exit Compare
              </button>
            )}
          </div>
        </div>
      )}

      {/* Executive KPIs */}
      <section>
        <SectionHeader title="Executive Summary" subtitle={periodLabel} />
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <KPICard
            title="Open Bugs"
            value={density?.open_bugs ?? 0}
            previousValue={isComparing ? prevDensity?.open_bugs : undefined}
            trend={isComparing ? calculateTrend(density?.open_bugs ?? 0, prevDensity?.open_bugs) : undefined}
            trendInverted={true}
            description={`${density?.open_high_priority ?? 0} critical`}
            color={(density?.open_bugs ?? 0) > 20 ? "error" : (density?.open_bugs ?? 0) > 10 ? "warning" : "success"}
            loading={densityLoading}
            infoKey="Open Bugs"
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
          <KPICard
            title="Automation"
            value={coverage?.coverage_percentage ?? 0}
            suffix="%"
            description={`${coverage?.automated_tickets ?? 0}/${coverage?.total_test_tickets ?? 0}`}
            color={(coverage?.coverage_percentage ?? 0) >= 70 ? "success" : (coverage?.coverage_percentage ?? 0) >= 50 ? "warning" : "error"}
            loading={coverageLoading}
            infoKey="Automation"
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
          />
          <KPICard
            title="Pass Rate"
            value={rpStats?.avg_pass_rate ?? 0}
            suffix="%"
            description="Avg last 10 runs"
            color={(rpStats?.avg_pass_rate ?? 0) >= 90 ? "success" : (rpStats?.avg_pass_rate ?? 0) >= 75 ? "warning" : "error"}
            loading={rpLoading}
            infoKey="Pass Rate"
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
          <KPICard
            title="PRs Merged"
            value={prStats?.merged_prs_last_30d ?? 0}
            previousValue={isComparing ? prevPrStats?.merged_prs_last_30d : undefined}
            trend={isComparing ? calculateTrend(prStats?.merged_prs_last_30d ?? 0, prevPrStats?.merged_prs_last_30d) : undefined}
            description={periodLabel}
            color="info"
            loading={prLoading}
            infoKey="PRs Merged"
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
          />
          <KPICard
            title="PRs Opened"
            value={prStats?.total_prs_last_30d ?? 0}
            previousValue={isComparing ? prevPrStats?.total_prs_last_30d : undefined}
            trend={isComparing ? calculateTrend(prStats?.total_prs_last_30d ?? 0, prevPrStats?.total_prs_last_30d) : undefined}
            description={periodLabel}
            color="info"
            loading={prLoading}
            infoKey="PRs Opened"
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>}
          />
          <KPICard
            title="Story Points"
            value={storyPoints?.total_completed ?? 0}
            previousValue={isComparing ? prevStoryPoints?.total_completed : undefined}
            trend={isComparing ? calculateTrend(storyPoints?.total_completed ?? 0, prevStoryPoints?.total_completed) : undefined}
            description={`${storyPoints?.total_in_progress ?? 0} in progress`}
            color="primary"
            loading={storyLoading}
            infoKey="Story Points"
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
          />
          <KPICard
            title="Reviews"
            value={reviewStats?.total_reviews ?? 0}
            previousValue={isComparing ? prevReviewStats?.total_reviews : undefined}
            trend={isComparing ? calculateTrend(reviewStats?.total_reviews ?? 0, prevReviewStats?.total_reviews) : undefined}
            description={`${reviewStats?.human_reviews ?? 0} human`}
            color="success"
            loading={reviewLoading}
            infoKey="Reviews"
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
          />
          <KPICard
            title="Flaky Tests"
            value={flaky?.total ?? 0}
            description="Needs attention"
            color={(flaky?.total ?? 0) > 5 ? "error" : (flaky?.total ?? 0) > 2 ? "warning" : "success"}
            loading={flakyLoading}
            infoKey="Flaky Tests"
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
          />
        </div>
      </section>

      {/* Story Points & Velocity */}
      <Section title="Story Points & Velocity" badge="Quarterly">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Velocity Summary Cards */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Completed</p>
              <p className="text-4xl font-bold text-[var(--success-base)]">{storyPoints?.total_completed ?? 0}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">points</p>
            </Card>
            <Card className="text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">In Progress</p>
              <p className="text-4xl font-bold text-[var(--warning-base)]">{storyPoints?.total_in_progress ?? 0}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">points</p>
            </Card>
            <Card className="text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Avg Velocity</p>
              <p className="text-4xl font-bold text-[var(--accent-primary)]">{storyPoints?.avg_velocity ?? 0}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">pts/week</p>
            </Card>
          </div>

          {/* Velocity Chart */}
          <Card className="lg:col-span-4">
            <div className="mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-[var(--text-primary)]">Weekly Velocity Trend</h3>
                <InfoTooltip text={METRIC_INFO["Velocity"]} />
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1">Committed vs completed story points</p>
            </div>
            {velocityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={velocityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="week" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip {...tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Bar dataKey="Committed" fill="var(--chart-1)" opacity={0.4} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Completed" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                  {isComparing && (
                    <Line type="monotone" dataKey="Prev Completed" stroke="var(--comparison-previous)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-[var(--text-muted)]">No velocity data available</div>
            )}
          </Card>
        </div>

        {/* Story Points by Member */}
        {storyPoints?.by_member?.length > 0 && (
          <Card className="mt-6">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Story Points by Member</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)]">
                    <th className="text-left py-3 px-4 text-[var(--text-muted)] font-medium">Member</th>
                    <th className="text-center py-3 px-4 text-[var(--text-muted)] font-medium">Completed</th>
                    <th className="text-center py-3 px-4 text-[var(--text-muted)] font-medium">In Progress</th>
                    <th className="text-center py-3 px-4 text-[var(--text-muted)] font-medium">Total Issues</th>
                    <th className="text-center py-3 px-4 text-[var(--text-muted)] font-medium">Issues Done</th>
                  </tr>
                </thead>
                <tbody>
                  {storyPoints.by_member.map((m: any) => (
                    <tr key={m.username} className="border-b border-[var(--border-subtle)]/40 hover:bg-[var(--bg-surface)]/50 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-medium text-[var(--text-primary)]">{m.username}</span>
                        <span className="text-[10px] text-[var(--text-muted)] ml-2">({m.jira_name})</span>
                      </td>
                      <td className="text-center py-3 px-4 text-[var(--success-base)] font-semibold">{m.completed_points}</td>
                      <td className="text-center py-3 px-4 text-[var(--warning-base)]">{m.in_progress_points}</td>
                      <td className="text-center py-3 px-4 text-[var(--text-tertiary)]">{m.total_issues}</td>
                      <td className="text-center py-3 px-4 text-[var(--info-base)]">{m.issues_completed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </Section>

      {/* Quality Metrics */}
      <Section title="Quality Metrics">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Defect Density */}
          <Card>
            <div className="mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-[var(--text-primary)]">Defect Trend</h3>
                <InfoTooltip text={METRIC_INFO["Defect Trend"]} />
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1">Bugs created vs resolved per week</p>
            </div>
            {defectTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={defectTrendData}>
                  <defs>
                    <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--error-base)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--error-base)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--success-base)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--success-base)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="week" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip {...tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Area type="monotone" dataKey="Created" stroke="var(--error-base)" strokeWidth={2} fill="url(#colorCreated)" dot={{ r: 3 }} />
                  <Area type="monotone" dataKey="Resolved" stroke="var(--success-base)" strokeWidth={2} fill="url(#colorResolved)" dot={{ r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-[var(--text-muted)]">No defect trend data</div>
            )}
          </Card>

          {/* Automation Coverage */}
          <Card>
            <div className="mb-4">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Automation Coverage</h3>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Test automation breakdown <span className="text-[var(--accent-primary)]">(click bars to view in Jira)</span>
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex-shrink-0 text-center">
                <div className="relative inline-flex items-center justify-center">
                  <svg className="w-32 h-32 -rotate-90">
                    <circle cx="64" cy="64" r="56" fill="none" stroke="var(--border-subtle)" strokeWidth="10" />
                    <circle
                      cx="64" cy="64" r="56" fill="none"
                      stroke={coverageColor}
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={`${(coverage?.coverage_percentage ?? 0) * 3.52} 352`}
                    />
                  </svg>
                  <span className="absolute text-3xl font-bold" style={{ color: coverageColor }}>
                    {coverage?.coverage_percentage ?? 0}%
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-2">
                  {coverage?.automated_tickets ?? 0} / {coverage?.total_test_tickets ?? 0}
                </p>
              </div>
              <div className="flex-1">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={automationChartData} layout="vertical" margin={{ left: 10 }}>
                    <XAxis type="number" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                    <YAxis type="category" dataKey="name" stroke="var(--text-muted)" fontSize={11} width={50} tickLine={false} />
                    <Tooltip {...tooltipStyle} />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={20} cursor="pointer" onClick={(data) => handleAutomationBarClick(data.name)}>
                      {automationChartData.map((entry) => (
                        <Cell key={entry.name} fill={AUTOMATION_COLORS[entry.name] || "var(--text-muted)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>
        </div>
      </Section>

      {/* PR & Review Activity */}
      <Section title="PR & Review Activity" badge="Team">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* PR Trend */}
          <Card>
            <div className="mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-[var(--text-primary)]">PR Activity Trend</h3>
                <InfoTooltip text={METRIC_INFO["PR Activity"]} />
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1">Pull requests opened and merged per week</p>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={mergedTrends}>
                <defs>
                  <linearGradient id="colorOpened" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorMerged" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="week" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Area type="monotone" dataKey="Opened" stroke="var(--chart-1)" strokeWidth={2} fill="url(#colorOpened)" dot={{ r: 3 }} />
                <Area type="monotone" dataKey="Merged" stroke="var(--chart-2)" strokeWidth={2} fill="url(#colorMerged)" dot={{ r: 3 }} />
                {isComparing && (
                  <>
                    <Line type="monotone" dataKey="Prev Opened" stroke="var(--comparison-previous)" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
                    <Line type="monotone" dataKey="Prev Merged" stroke="var(--comparison-previous)" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
                  </>
                )}
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          {/* Review Trend */}
          <Card>
            <div className="mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-[var(--text-primary)]">Review Activity Trend</h3>
                <InfoTooltip text={METRIC_INFO["Review Activity"]} />
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1">Code reviews completed per week</p>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={reviewTrendData}>
                <defs>
                  <linearGradient id="colorReviews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-4)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--chart-4)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="week" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Area type="monotone" dataKey="Reviews" stroke="var(--chart-4)" strokeWidth={2} fill="url(#colorReviews)" dot={{ r: 3 }} />
                {isComparing && (
                  <Line type="monotone" dataKey="Prev Reviews" stroke="var(--comparison-previous)" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Team Contributions */}
        {contributions?.members?.length > 0 && (
          <Card className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-[var(--text-primary)]">QA Team Contributions</h3>
                <p className="text-xs text-[var(--text-muted)] mt-1">{periodLabel} · {contributions.total_prs} PRs total</p>
              </div>
              <span className="px-3 py-1 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] text-xs font-medium border border-[var(--accent-primary)]/20">
                {contributions.members.length} active members
              </span>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={contributions.members.map((m: any) => ({ name: m.username, Opened: m.prs_opened, Merged: m.prs_merged }))} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
                <XAxis type="number" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                <YAxis type="category" dataKey="name" stroke="var(--text-muted)" fontSize={11} width={150} tickLine={false} />
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar dataKey="Opened" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Merged" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Top Reviewers */}
        {reviewStats?.reviewers?.length > 0 && (
          <Card className="mt-6">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Top Reviewers</h3>
              <p className="text-xs text-[var(--text-muted)] mt-1">Code review activity breakdown</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)]">
                    <th className="text-left py-3 px-4 text-[var(--text-muted)] font-medium">Reviewer</th>
                    <th className="text-center py-3 px-4 text-[var(--text-muted)] font-medium">Total</th>
                    <th className="text-center py-3 px-4 text-[var(--text-muted)] font-medium">Approved</th>
                    <th className="text-center py-3 px-4 text-[var(--text-muted)] font-medium">Changes</th>
                    <th className="text-center py-3 px-4 text-[var(--text-muted)] font-medium">Comments</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewStats.reviewers.map((r: any) => (
                    <tr key={r.username} className="border-b border-[var(--border-subtle)]/40 hover:bg-[var(--bg-surface)]/50 transition-colors">
                      <td className="py-3 px-4">
                        <span className={`font-medium ${r.username.toLowerCase().includes("copilot") || r.username.toLowerCase().includes("[bot]") ? "text-[var(--success-base)]" : "text-[var(--text-primary)]"}`}>
                          {r.username}
                          {(r.username.toLowerCase().includes("copilot") || r.username.toLowerCase().includes("[bot]")) && (
                            <span className="ml-2 text-[10px] bg-[var(--success-subtle)] text-[var(--success-base)] px-1.5 py-0.5 rounded">AI</span>
                          )}
                        </span>
                      </td>
                      <td className="text-center py-3 px-4 text-[var(--info-base)] font-semibold">{r.reviews_given}</td>
                      <td className="text-center py-3 px-4 text-[var(--success-base)]">{r.approvals}</td>
                      <td className="text-center py-3 px-4 text-[var(--warning-base)]">{r.changes_requested}</td>
                      <td className="text-center py-3 px-4 text-[var(--text-tertiary)]">{r.comments}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </Section>

      {/* Test Execution */}
      <Section title="Test Execution">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ReportPortal Stats */}
          <Card>
            <div className="mb-4">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">ReportPortal Stats</h3>
              <p className="text-xs text-[var(--text-muted)] mt-1">Test execution summary from last 10 runs</p>
            </div>
            {rpStats ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-4 rounded-xl bg-[var(--bg-surface)]">
                    <p className="text-2xl font-bold text-[var(--success-base)]">{rpStats.avg_pass_rate}%</p>
                    <p className="text-xs text-[var(--text-muted)]">Pass Rate</p>
                  </div>
                  <div className="p-4 rounded-xl bg-[var(--bg-surface)]">
                    <p className="text-2xl font-bold text-[var(--text-primary)]">{rpStats.total_launches}</p>
                    <p className="text-xs text-[var(--text-muted)]">Launches</p>
                  </div>
                  <div className="p-4 rounded-xl bg-[var(--bg-surface)]">
                    <p className="text-2xl font-bold text-[var(--info-base)]">{rpStats.total_tests}</p>
                    <p className="text-xs text-[var(--text-muted)]">Total Tests</p>
                  </div>
                </div>
                {rpStats.recent_launches?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Recent Launches</p>
                    {rpStats.recent_launches.slice(0, 5).map((launch: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-surface)]">
                        <span className="text-sm text-[var(--text-secondary)] truncate max-w-[200px]">{launch.name}</span>
                        <span className={`text-sm font-semibold ${launch.pass_rate >= 90 ? "text-[var(--success-base)]" : launch.pass_rate >= 75 ? "text-[var(--warning-base)]" : "text-[var(--error-base)]"}`}>
                          {launch.pass_rate}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-[var(--text-muted)]">No ReportPortal data available</div>
            )}
          </Card>

          {/* Flaky Tests */}
          <Card>
            <div className="mb-4">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Flaky Tests</h3>
              <p className="text-xs text-[var(--text-muted)] mt-1">Tests with unstable results</p>
            </div>
            <FlakyTestsTable />
          </Card>
        </div>
      </Section>

      {/* Bug Tracker */}
      <Section title="Bug Tracker" badge={`${density?.open_bugs ?? 0} open`}>
        <BugTable project={project} quarter={quarter} />
      </Section>

      {/* Comparison Summary */}
      {isComparing && (
        <section className="rounded-2xl bg-gradient-to-br from-[var(--bg-elevated)] to-[var(--bg-surface)] border border-[var(--border-subtle)] p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Period Comparison Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1">Bug Delta</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-[var(--text-primary)]">
                  {(density?.open_bugs ?? 0) - (prevDensity?.open_bugs ?? 0)}
                </span>
                <TrendArrow value={calculateTrend(density?.open_bugs ?? 0, prevDensity?.open_bugs) ?? 0} inverted={true} />
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1">PR Delta</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-[var(--text-primary)]">
                  {(prStats?.merged_prs_last_30d ?? 0) - (prevPrStats?.merged_prs_last_30d ?? 0)}
                </span>
                <TrendArrow value={calculateTrend(prStats?.merged_prs_last_30d ?? 0, prevPrStats?.merged_prs_last_30d) ?? 0} />
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1">Points Delta</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-[var(--text-primary)]">
                  {((storyPoints?.total_completed ?? 0) - (prevStoryPoints?.total_completed ?? 0)).toFixed(1)}
                </span>
                <TrendArrow value={calculateTrend(storyPoints?.total_completed ?? 0, prevStoryPoints?.total_completed) ?? 0} />
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1">Review Delta</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-[var(--text-primary)]">
                  {(reviewStats?.total_reviews ?? 0) - (prevReviewStats?.total_reviews ?? 0)}
                </span>
                <TrendArrow value={calculateTrend(reviewStats?.total_reviews ?? 0, prevReviewStats?.total_reviews) ?? 0} />
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
