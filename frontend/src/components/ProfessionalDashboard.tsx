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
} from "recharts";
import {
  useDefectDensity,
  useAutomationCoverage,
  usePRStats,
  usePRTrends,
  useTeamContributions,
} from "../hooks/useMetrics";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { API_BASE_URL } from "../config";

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

interface Props {
  project: string | null;
  quarter: string;
  compareQuarter: string | null;
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
  if (value === 0) return <span className="text-[var(--text-muted)]">-</span>;

  const isPositive = inverted ? value < 0 : value > 0;
  const color = isPositive ? "var(--success-base)" : "var(--error-base)";
  const arrow = value > 0 ? "+" : "";

  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color }}>
      {isPositive ? (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      )}
      {arrow}{Math.abs(value).toFixed(1)}%
    </span>
  );
}

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
    <div
      className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-5 transition-all duration-200 hover:border-[var(--border-emphasis)] hover:shadow-lg group"
      style={{ boxShadow: `0 0 0 0 ${colors.subtle}` }}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          {title}
        </span>
        {icon && (
          <div
            className="p-2 rounded-lg transition-colors"
            style={{ backgroundColor: colors.subtle }}
          >
            <div style={{ color: colors.bg }}>{icon}</div>
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span
          className="text-3xl font-bold tracking-tight text-display"
          style={{ color: colors.bg }}
        >
          {value}{suffix}
        </span>
        {trend !== undefined && (
          <TrendArrow value={trend} inverted={trendInverted} />
        )}
      </div>

      {previousValue !== undefined && (
        <div className="mt-2 text-xs text-[var(--text-muted)]">
          Previous: <span className="text-[var(--text-tertiary)]">{previousValue}{suffix}</span>
        </div>
      )}

      {description && (
        <p className="mt-2 text-xs text-[var(--text-muted)]">{description}</p>
      )}
    </div>
  );
}

// Section Header
function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)] tracking-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm text-[var(--text-muted)] mt-0.5">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

// Card wrapper
function Card({
  children,
  className = "",
  padding = true,
}: {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] ${
        padding ? "p-6" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export default function ProfessionalDashboard({ project, quarter, compareQuarter }: Props) {
  const isComparing = !!compareQuarter;

  // Current period data
  const { data: density, isLoading: densityLoading } = useDefectDensity(null, project, quarter);
  const { data: coverage, isLoading: coverageLoading } = useAutomationCoverage(null, project);
  const { data: prStats, isLoading: prLoading } = usePRStats(null, project, quarter);
  const { data: prTrends } = usePRTrends(null, project, quarter);
  const { data: storyPoints, isLoading: storyLoading } = useStoryPoints(project, quarter);
  const { data: reviewStats, isLoading: reviewLoading } = useTeamReviewStats(project, quarter);
  const { data: contributions } = useTeamContributions(null, project, quarter);

  // Comparison period data (only fetch if comparing)
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

  // Merge PR trends for comparison chart
  const mergedTrends = useMemo(() => {
    if (!prTrends?.trends) return [];

    const currentMap = new Map(
      prTrends.trends.map((t: any) => [t.week, { ...t, period: "current" }])
    );

    if (isComparing && prevPrTrends?.trends) {
      prevPrTrends.trends.forEach((t: any) => {
        const existing = currentMap.get(t.week);
        if (existing) {
          currentMap.set(t.week, {
            ...existing,
            prevOpened: t.opened,
            prevMerged: t.merged,
          });
        }
      });
    }

    return Array.from(currentMap.values())
      .map((t: any) => ({
        week: t.week.replace(/^\d{4}-W/, "W"),
        "Current Opened": t.opened,
        "Current Merged": t.merged,
        ...(isComparing && {
          "Previous Opened": t.prevOpened || 0,
          "Previous Merged": t.prevMerged || 0,
        }),
      }))
      .slice(-12);
  }, [prTrends, prevPrTrends, isComparing]);

  // Merge review trends for comparison
  const mergedReviewTrends = useMemo(() => {
    if (!reviewStats?.weekly_trend) return [];

    return reviewStats.weekly_trend.map((t: any, i: number) => ({
      week: t.week.replace(/^\d{4}-W/, "W"),
      "Current Reviews": t.reviewed,
      ...(isComparing && prevReviewStats?.weekly_trend && {
        "Previous Reviews": prevReviewStats.weekly_trend[i]?.reviewed || 0,
      }),
    }));
  }, [reviewStats, prevReviewStats, isComparing]);

  // Velocity chart data
  const velocityData = useMemo(() => {
    if (!storyPoints?.velocity_trend) return [];

    return storyPoints.velocity_trend.map((v: any, i: number) => ({
      week: v.sprint_name.replace(/^\d{4}-W/, "W"),
      Committed: v.committed_points,
      Completed: v.completed_points,
      ...(isComparing && prevStoryPoints?.velocity_trend && {
        "Prev Committed": prevStoryPoints.velocity_trend[i]?.committed_points || 0,
        "Prev Completed": prevStoryPoints.velocity_trend[i]?.completed_points || 0,
      }),
    }));
  }, [storyPoints, prevStoryPoints, isComparing]);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Comparison Banner */}
      {isComparing && (
        <div className="rounded-xl bg-gradient-to-r from-[var(--accent-primary)]/10 to-[var(--accent-secondary)]/10 border border-[var(--accent-primary)]/20 p-4">
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
              <p className="text-xs text-[var(--text-muted)]">
                Trends show percentage change from previous period
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Executive KPIs */}
      <section>
        <SectionHeader
          title="Executive Summary"
          subtitle={`Key performance indicators for ${periodLabel}`}
        />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KPICard
            title="Open Bugs"
            value={density?.open_bugs ?? 0}
            previousValue={isComparing ? prevDensity?.open_bugs : undefined}
            trend={isComparing ? calculateTrend(density?.open_bugs ?? 0, prevDensity?.open_bugs) : undefined}
            trendInverted={true}
            description={`${density?.open_high_priority ?? 0} critical`}
            color={
              (density?.open_bugs ?? 0) > 20
                ? "error"
                : (density?.open_bugs ?? 0) > 10
                ? "warning"
                : "success"
            }
            loading={densityLoading}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <KPICard
            title="Automation"
            value={coverage?.coverage_percentage ?? 0}
            suffix="%"
            description={`${coverage?.automated_tickets ?? 0}/${coverage?.total_test_tickets ?? 0} tests`}
            color={
              (coverage?.coverage_percentage ?? 0) >= 70
                ? "success"
                : (coverage?.coverage_percentage ?? 0) >= 50
                ? "warning"
                : "error"
            }
            loading={coverageLoading}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            }
          />
          <KPICard
            title="PRs Merged"
            value={prStats?.merged_prs_last_30d ?? 0}
            previousValue={isComparing ? prevPrStats?.merged_prs_last_30d : undefined}
            trend={isComparing ? calculateTrend(prStats?.merged_prs_last_30d ?? 0, prevPrStats?.merged_prs_last_30d) : undefined}
            description={periodLabel}
            color="info"
            loading={prLoading}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
          />
          <KPICard
            title="Story Points"
            value={storyPoints?.total_completed ?? 0}
            previousValue={isComparing ? prevStoryPoints?.total_completed : undefined}
            trend={isComparing ? calculateTrend(storyPoints?.total_completed ?? 0, prevStoryPoints?.total_completed) : undefined}
            description={`${storyPoints?.total_in_progress ?? 0} in progress`}
            color="primary"
            loading={storyLoading}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            }
          />
          <KPICard
            title="Reviews"
            value={reviewStats?.total_reviews ?? 0}
            previousValue={isComparing ? prevReviewStats?.total_reviews : undefined}
            trend={isComparing ? calculateTrend(reviewStats?.total_reviews ?? 0, prevReviewStats?.total_reviews) : undefined}
            description={`${reviewStats?.human_reviews ?? 0} human`}
            color="success"
            loading={reviewLoading}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            }
          />
          <KPICard
            title="Velocity"
            value={storyPoints?.avg_velocity ?? 0}
            previousValue={isComparing ? prevStoryPoints?.avg_velocity : undefined}
            trend={isComparing ? calculateTrend(storyPoints?.avg_velocity ?? 0, prevStoryPoints?.avg_velocity) : undefined}
            suffix=" pts/wk"
            color="warning"
            loading={storyLoading}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            }
          />
        </div>
      </section>

      {/* Trend Charts Row */}
      <section>
        <SectionHeader
          title="Performance Trends"
          subtitle="Weekly activity patterns and velocity tracking"
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* PR Activity Trend */}
          <Card>
            <div className="mb-6">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                PR Activity Trend
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Pull requests opened and merged per week
              </p>
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
                <Legend wrapperStyle={{ fontSize: "12px", color: "var(--text-tertiary)" }} />
                <Area
                  type="monotone"
                  dataKey="Current Opened"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="url(#colorOpened)"
                  dot={{ r: 3, fill: "var(--chart-1)" }}
                />
                <Area
                  type="monotone"
                  dataKey="Current Merged"
                  stroke="var(--chart-2)"
                  strokeWidth={2}
                  fill="url(#colorMerged)"
                  dot={{ r: 3, fill: "var(--chart-2)" }}
                />
                {isComparing && (
                  <>
                    <Line
                      type="monotone"
                      dataKey="Previous Opened"
                      stroke="var(--comparison-previous)"
                      strokeWidth={1.5}
                      strokeDasharray="5 5"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="Previous Merged"
                      stroke="var(--comparison-previous)"
                      strokeWidth={1.5}
                      strokeDasharray="5 5"
                      dot={false}
                    />
                  </>
                )}
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          {/* Review Activity Trend */}
          <Card>
            <div className="mb-6">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                Review Activity Trend
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Code reviews completed per week
              </p>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={mergedReviewTrends}>
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
                <Legend wrapperStyle={{ fontSize: "12px", color: "var(--text-tertiary)" }} />
                <Area
                  type="monotone"
                  dataKey="Current Reviews"
                  stroke="var(--chart-4)"
                  strokeWidth={2}
                  fill="url(#colorReviews)"
                  dot={{ r: 3, fill: "var(--chart-4)" }}
                />
                {isComparing && (
                  <Line
                    type="monotone"
                    dataKey="Previous Reviews"
                    stroke="var(--comparison-previous)"
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </section>

      {/* Velocity Section */}
      <section>
        <SectionHeader
          title="Sprint Velocity"
          subtitle="Story points committed vs completed"
        />
        <Card>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={velocityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis dataKey="week" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
              <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: "12px", color: "var(--text-tertiary)" }} />
              <Bar dataKey="Committed" fill="var(--chart-1)" opacity={0.4} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Completed" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              {isComparing && (
                <>
                  <Line
                    type="monotone"
                    dataKey="Prev Committed"
                    stroke="var(--comparison-previous)"
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="Prev Completed"
                    stroke="var(--chart-3)"
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      </section>

      {/* Team Performance */}
      <section>
        <SectionHeader
          title="Team Performance"
          subtitle="Individual contributor metrics"
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Story Points by Member */}
          <Card>
            <div className="mb-4">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                Story Points by Member
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Completed and in-progress points
              </p>
            </div>
            {storyPoints?.by_member?.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={storyPoints.by_member.slice(0, 8).map((m: any) => ({
                    name: m.username,
                    Completed: m.completed_points,
                    "In Progress": m.in_progress_points,
                  }))}
                  layout="vertical"
                  margin={{ left: 10, right: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
                  <XAxis type="number" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="var(--text-muted)"
                    fontSize={11}
                    tickLine={false}
                    width={120}
                  />
                  <Tooltip {...tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Bar dataKey="Completed" stackId="a" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="In Progress" stackId="a" fill="var(--chart-3)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-[var(--text-muted)]">
                No story point data available
              </div>
            )}
          </Card>

          {/* Top Reviewers */}
          <Card>
            <div className="mb-4">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                Top Reviewers
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Code review activity breakdown
              </p>
            </div>
            {reviewStats?.reviewers?.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={reviewStats.reviewers.slice(0, 8).map((r: any) => ({
                    name: r.username.length > 15 ? r.username.slice(0, 15) + "..." : r.username,
                    Approved: r.approvals,
                    "Changes Requested": r.changes_requested,
                    Commented: r.comments,
                  }))}
                  layout="vertical"
                  margin={{ left: 10, right: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
                  <XAxis type="number" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="var(--text-muted)"
                    fontSize={10}
                    tickLine={false}
                    width={140}
                  />
                  <Tooltip {...tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Bar dataKey="Approved" stackId="a" fill="var(--chart-2)" />
                  <Bar dataKey="Changes Requested" stackId="a" fill="var(--chart-3)" />
                  <Bar dataKey="Commented" stackId="a" fill="var(--text-muted)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-[var(--text-muted)]">
                No review data available
              </div>
            )}
          </Card>
        </div>
      </section>

      {/* Summary Stats Footer */}
      {isComparing && (
        <section className="rounded-2xl bg-gradient-to-br from-[var(--bg-elevated)] to-[var(--bg-surface)] border border-[var(--border-subtle)] p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            Period Comparison Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1">Bug Delta</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-[var(--text-primary)]">
                  {((density?.open_bugs ?? 0) - (prevDensity?.open_bugs ?? 0))}
                </span>
                <TrendArrow
                  value={calculateTrend(density?.open_bugs ?? 0, prevDensity?.open_bugs) ?? 0}
                  inverted={true}
                />
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1">PR Delta</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-[var(--text-primary)]">
                  {((prStats?.merged_prs_last_30d ?? 0) - (prevPrStats?.merged_prs_last_30d ?? 0))}
                </span>
                <TrendArrow
                  value={calculateTrend(prStats?.merged_prs_last_30d ?? 0, prevPrStats?.merged_prs_last_30d) ?? 0}
                />
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1">Points Delta</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-[var(--text-primary)]">
                  {((storyPoints?.total_completed ?? 0) - (prevStoryPoints?.total_completed ?? 0)).toFixed(1)}
                </span>
                <TrendArrow
                  value={calculateTrend(storyPoints?.total_completed ?? 0, prevStoryPoints?.total_completed) ?? 0}
                />
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1">Review Delta</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-[var(--text-primary)]">
                  {((reviewStats?.total_reviews ?? 0) - (prevReviewStats?.total_reviews ?? 0))}
                </span>
                <TrendArrow
                  value={calculateTrend(reviewStats?.total_reviews ?? 0, prevReviewStats?.total_reviews) ?? 0}
                />
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
