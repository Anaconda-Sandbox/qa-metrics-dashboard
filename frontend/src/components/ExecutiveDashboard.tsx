import { useState, useEffect, useMemo } from "react";
import InfoTip from "./InfoTip";
import {
  AreaChart,
  Area,
  Bar,
  BarChart,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  ComposedChart,
  Line,
} from "recharts";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface AutomationProjectMetric {
  project: string;
  launches: number;
  pass_rate_pct: number;
  avg_duration_sec: number;
  flaky_pct: number | null;
  total_tests: number;
}

interface AutomationHealth {
  quarter: string;
  overall: {
    pass_rate_pct: number;
    avg_duration_sec: number;
    total_launches: number;
    total_tests: number;
    total_passed: number;
  };
  by_project: AutomationProjectMetric[];
  snapshot_date?: string;
}

interface ExecutiveMetrics {
  open_bugs: number;
  resolved_bugs: number;
  bugs_fixed_by_qa: number;
  critical_bugs: number;
  bug_resolution_rate: number | null;
  defect_density: number | null;
  story_points_completed: number;
  story_points_in_progress: number;
  tickets_completed: number;
  avg_cycle_time_hours: number | null;
  prs_merged: number;
  prs_opened: number;
  total_reviews: number;
  avg_pr_merge_time_hours: number | null;
  defect_trend: Array<{ week: string; created: number; resolved: number }>;
  pr_trend: Array<{ week: string; opened: number; merged: number }>;
  velocity_trend: Array<{ week: string; completed_points: number; tickets_completed: number }>;
  review_trend: Array<{ week: string; reviews: number }>;
  team_contributions: Array<{ user_name: string; prs_opened: number; prs_merged: number }>;
  story_points_by_member: Array<{
    user_name: string;
    completed_points: number;
    in_progress_points: number;
    total_issues: number;
    issues_completed: number;
  }>;
  top_reviewers: Array<{
    user_name: string;
    reviews_given: number;
    approvals: number;
    changes_requested: number;
    comments: number;
  }>;
  automation_health: AutomationHealth | null;
}

interface QAReportedBugs {
  quarter: string;
  total: number;
  critical: number;
}

interface Props {
  quarter: string;
  project: string;
  compareQuarter: string | null;
  onExitCompare?: () => void;
}

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

// Custom Recharts tooltip components for the per-project Automation Health charts.
// Looks up the project by name and renders a richer hover than the default
// "Pass %: 87.92" so leadership sees the project name + supporting context.
const rpTipBoxStyle: React.CSSProperties = {
  backgroundColor: "rgba(15, 20, 25, 0.95)",
  border: "1px solid rgba(71, 85, 105, 0.3)",
  borderRadius: 12,
  padding: "12px 16px",
  boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
  fontSize: 12,
};

function makeMetricLookup(items: AutomationProjectMetric[]): Record<string, AutomationProjectMetric> {
  const m: Record<string, AutomationProjectMetric> = {};
  for (const it of items) m[it.project] = it;
  return m;
}

function makePassRateTooltip(lookup: Record<string, AutomationProjectMetric>) {
  return (props: any) => {
    const { active, payload } = props || {};
    if (!active || !payload?.length) return null;
    const name = payload[0]?.payload?.name;
    const m = name ? lookup[name] : undefined;
    if (!m) return null;
    return (
      <div style={rpTipBoxStyle}>
        <div style={{ color: "#F1F5F9", fontWeight: 600, marginBottom: 6 }}>{m.project}</div>
        <div style={{ color: "var(--success-base)", fontWeight: 700 }}>{m.pass_rate_pct.toFixed(2)}% pass rate</div>
        <div style={{ color: "#94a3b8", marginTop: 4 }}>{m.launches} launches · {m.total_tests.toLocaleString()} tests</div>
      </div>
    );
  };
}

function makeDurationTooltip(lookup: Record<string, AutomationProjectMetric>) {
  return (props: any) => {
    const { active, payload } = props || {};
    if (!active || !payload?.length) return null;
    const name = payload[0]?.payload?.name;
    const m = name ? lookup[name] : undefined;
    if (!m) return null;
    const minutes = Math.round(m.avg_duration_sec / 60);
    const hours = m.avg_duration_sec >= 3600 ? `${(m.avg_duration_sec / 3600).toFixed(1)}h` : null;
    return (
      <div style={rpTipBoxStyle}>
        <div style={{ color: "#F1F5F9", fontWeight: 600, marginBottom: 6 }}>{m.project}</div>
        <div style={{ color: "var(--info-base)", fontWeight: 700 }}>{minutes} min{hours ? ` · ${hours}` : ""} avg</div>
        <div style={{ color: "#94a3b8", marginTop: 4 }}>across {m.launches} launches</div>
      </div>
    );
  };
}

function makeFlakyTooltip(lookup: Record<string, AutomationProjectMetric>) {
  return (props: any) => {
    const { active, payload } = props || {};
    if (!active || !payload?.length) return null;
    const name = payload[0]?.payload?.name;
    const m = name ? lookup[name] : undefined;
    if (!m || m.flaky_pct === null) return null;
    const v = m.flaky_pct;
    const color = v <= 5 ? "var(--success-base)" : v <= 10 ? "var(--warning-base)" : "var(--error-base)";
    return (
      <div style={rpTipBoxStyle}>
        <div style={{ color: "#F1F5F9", fontWeight: 600, marginBottom: 6 }}>{m.project}</div>
        <div style={{ color, fontWeight: 700 }}>{v.toFixed(2)}% flaky</div>
        <div style={{ color: "#94a3b8", marginTop: 4 }}>tests alternating pass/fail · {m.launches} launches sampled</div>
      </div>
    );
  };
}

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function KPICard({
  title,
  value,
  suffix = "",
  description,
  trend,
  trendInverted = false,
  color = "primary",
  loading = false,
  scrollTo,
  tooltip,
}: {
  title: string;
  value: number | string;
  suffix?: string;
  description?: string;
  trend?: number;
  trendInverted?: boolean;
  color?: "primary" | "success" | "warning" | "error" | "info";
  loading?: boolean;
  scrollTo?: string;
  tooltip?: string;
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

  const isPositive = trendInverted ? (trend ?? 0) < 0 : (trend ?? 0) > 0;
  const interactive = !!scrollTo;
  const handleActivate = () => {
    if (scrollTo) scrollToSection(scrollTo);
  };

  const baseClass = "rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-5 transition-all duration-200 text-left w-full";
  const interactiveClass = interactive
    ? "cursor-pointer hover:border-[var(--accent-primary)]/60 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/40"
    : "hover:border-[var(--border-emphasis)] hover:shadow-lg";

  const inner = (
    <>
      <div className="flex items-start justify-between mb-3 gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
          {title}
          {tooltip && <InfoTip>{tooltip}</InfoTip>}
        </span>
        {interactive && (
          <svg
            className="w-3.5 h-3.5 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold tracking-tight" style={{ color: colors.bg }}>
          {value}{suffix}
        </span>
        {trend !== undefined && trend !== null && (
          <span className={`flex items-center gap-1 text-xs font-semibold ${isPositive ? "text-[var(--success-base)]" : "text-[var(--error-base)]"}`}>
            {trend > 0 ? "+" : ""}{trend.toFixed(1)}%
            <svg className={`w-3 h-3 ${!isPositive ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </span>
        )}
      </div>
      {description && <p className="mt-2 text-xs text-[var(--text-muted)]">{description}</p>}
    </>
  );

  if (interactive) {
    return (
      <button type="button" onClick={handleActivate} className={`group ${baseClass} ${interactiveClass}`} aria-label={`${title}, jump to detail`}>
        {inner}
      </button>
    );
  }
  return (
    <div className={`${baseClass} ${interactiveClass}`}>{inner}</div>
  );
}

function SectionHeader({ title, subtitle, badge }: { title: string; subtitle?: string; badge?: string }) {
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
      {subtitle && <p className="text-sm text-[var(--text-muted)]">{subtitle}</p>}
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-6 ${className}`}>
      {children}
    </div>
  );
}

export default function ExecutiveDashboard({ quarter, project, compareQuarter, onExitCompare }: Props) {
  const [data, setData] = useState<ExecutiveMetrics | null>(null);
  const [compareData, setCompareData] = useState<ExecutiveMetrics | null>(null);
  const [bugsData, setBugsData] = useState<QAReportedBugs | null>(null);
  const [compareBugsData, setCompareBugsData] = useState<QAReportedBugs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isComparing = !!compareQuarter;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const fetchJson = async <T,>(url: string): Promise<T | null> => {
          const r = await fetch(url);
          return r.ok ? ((await r.json()) as T) : null;
        };

        const projectQS = project && project !== "ALL" ? `&project=${encodeURIComponent(project)}` : "";

        const [exec, bugs] = await Promise.all([
          fetchJson<ExecutiveMetrics>(`${API_BASE}/api/dx/executive?quarter=${quarter}${projectQS}`),
          fetchJson<QAReportedBugs>(`${API_BASE}/api/jira/qa-reported-bugs?quarter=${quarter}${projectQS}`),
        ]);
        if (!exec) throw new Error("Failed to fetch executive metrics");
        setData(exec);
        setBugsData(bugs);

        if (compareQuarter) {
          const [execCmp, bugsCmp] = await Promise.all([
            fetchJson<ExecutiveMetrics>(`${API_BASE}/api/dx/executive?quarter=${compareQuarter}${projectQS}`),
            fetchJson<QAReportedBugs>(`${API_BASE}/api/jira/qa-reported-bugs?quarter=${compareQuarter}${projectQS}`),
          ]);
          setCompareData(execCmp);
          setCompareBugsData(bugsCmp);
        } else {
          setCompareData(null);
          setCompareBugsData(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [quarter, project, compareQuarter]);

  const calculateTrend = (current: number, previous: number | undefined) => {
    if (!previous || previous === 0) return undefined;
    return ((current - previous) / previous) * 100;
  };

  const defectTrendData = useMemo(() => {
    if (!data?.defect_trend) return [];
    return data.defect_trend.map((d) => ({
      week: d.week.slice(5),
      Created: d.created,
      Resolved: d.resolved,
    }));
  }, [data]);

  const prTrendData = useMemo(() => {
    if (!data?.pr_trend) return [];
    return data.pr_trend.map((d) => ({
      week: d.week.slice(5),
      Opened: d.opened,
      Merged: d.merged,
    }));
  }, [data]);

  const velocityTrendData = useMemo(() => {
    if (!data?.velocity_trend) return [];
    return data.velocity_trend.map((d) => ({
      week: d.week.slice(5),
      Points: Math.round(d.completed_points),
      Tickets: d.tickets_completed,
    }));
  }, [data]);

  const reviewTrendData = useMemo(() => {
    if (!data?.review_trend) return [];
    return data.review_trend.map((d) => ({
      week: d.week.slice(5),
      Reviews: d.reviews,
    }));
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center animate-pulse">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-[var(--text-muted)]">Loading executive metrics from DX Data Cloud...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--error-subtle)] flex items-center justify-center">
          <svg className="w-8 h-8 text-[var(--error-base)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-[var(--error-base)] font-medium">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const periodLabel = quarter.replace("-", " ");

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
                  <span className="text-[var(--text-tertiary)]">{compareQuarter?.replace("-", " ")}</span>
                </p>
                <p className="text-xs text-[var(--text-muted)]">Data sourced from DX Data Cloud</p>
              </div>
            </div>
            {onExitCompare && (
              <button
                onClick={onExitCompare}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-overlay)] transition-all"
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

      {/* Data Source Badge */}
      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
        <div className="w-2 h-2 rounded-full bg-[var(--accent-primary)] animate-pulse" />
        <span>Data from DX Data Cloud</span>
        <span className="text-[var(--border-subtle)]">|</span>
        <span>{periodLabel}</span>
      </div>

      {/* Executive KPIs */}
      <section>
        <SectionHeader title="Executive Summary" subtitle={periodLabel} />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
          <KPICard
            title="Coverage"
            value={28}
            suffix=" Projects"
            description="24 dedicated + 4 support"
            color="info"
            tooltip="Total number of projects under QA coverage. Dedicated = QA owns the test plan; Support = QA assists when needed."
          />
          <KPICard
            title="QA-Reported Bugs"
            scrollTo="quality-metrics"
            tooltip='Bugs created in this quarter where the reporter or creator is in the QA Jira group. "High priority" sub-count = priority Highest or High (Jira has no "Critical" value).'
            value={bugsData?.total ?? data.open_bugs}
            description={`${bugsData?.critical ?? data.critical_bugs} high priority`}
            trend={
              isComparing
                ? calculateTrend(
                    bugsData?.total ?? data.open_bugs,
                    compareBugsData?.total ?? compareData?.open_bugs
                  )
                : undefined
            }
            trendInverted={true}
            color={(bugsData?.total ?? data.open_bugs) > 20 ? "error" : (bugsData?.total ?? data.open_bugs) > 10 ? "warning" : "success"}
          />
          <KPICard
            title="Resolution Rate"
            scrollTo="quality-metrics"
            tooltip="Of bugs reported by QA in this quarter, the % that have been resolved (resolutiondate set). Tracks the in-flight quality of new reports — bugs reported in earlier quarters and resolved here are not counted."
            value={data.bug_resolution_rate ?? 0}
            suffix="%"
            description="Bugs resolved"
            trend={isComparing ? calculateTrend(data.bug_resolution_rate ?? 0, compareData?.bug_resolution_rate ?? undefined) : undefined}
            color={(data.bug_resolution_rate ?? 0) >= 80 ? "success" : (data.bug_resolution_rate ?? 0) >= 60 ? "warning" : "error"}
          />
          <KPICard
            title="Bugs Fixed by QA"
            scrollTo="quality-metrics"
            tooltip='Tickets carrying the "qa-fixed" label that were updated this quarter. The QA team applies this label to bugs they found and fixed themselves (often QA-reported, frequently QA-assigned).'
            value={data.bugs_fixed_by_qa}
            description={`qa-fixed in ${periodLabel}`}
            trend={isComparing ? calculateTrend(data.bugs_fixed_by_qa, compareData?.bugs_fixed_by_qa) : undefined}
            color="success"
          />
          <KPICard
            title="Total PRs"
            scrollTo="quality-metrics"
            tooltip="Pull requests opened by the QA team in this quarter. Excludes bot-authored PRs. Source: DX Data Cloud (GitHub data via DX)."
            value={data.prs_opened}
            description={periodLabel}
            trend={isComparing ? calculateTrend(data.prs_opened, compareData?.prs_opened) : undefined}
            color="info"
          />
          <KPICard
            title="Total Merges"
            scrollTo="quality-metrics"
            tooltip="Pull requests opened in this quarter that have a merged timestamp. Excludes bot-authored PRs."
            value={data.prs_merged}
            description={periodLabel}
            trend={isComparing ? calculateTrend(data.prs_merged, compareData?.prs_merged) : undefined}
            color="info"
          />
          <KPICard
            title="Avg Merge Time"
            scrollTo="quality-metrics"
            tooltip="Average hours from PR open to merge across QA-team PRs in this quarter. Excludes bot PRs and unmerged PRs. Color-graded: ≤24h green, ≤72h amber, else red."
            value={data.avg_pr_merge_time_hours ? Math.round(data.avg_pr_merge_time_hours) : 0}
            suffix="h"
            description="Open to merge"
            trend={
              isComparing
                ? calculateTrend(
                    data.avg_pr_merge_time_hours ?? 0,
                    compareData?.avg_pr_merge_time_hours ?? undefined
                  )
                : undefined
            }
            trendInverted={true}
            color={
              data.avg_pr_merge_time_hours == null
                ? "info"
                : data.avg_pr_merge_time_hours <= 24
                ? "success"
                : data.avg_pr_merge_time_hours <= 72
                ? "warning"
                : "error"
            }
          />
          <KPICard
            title="Pass Rate"
            scrollTo="automation-health"
            tooltip="Overall ReportPortal test pass rate this quarter, weighted across all projects. Counts only branch=main launches (excludes feature-branch noise). Target 90%."
            value={data.automation_health?.overall.pass_rate_pct ?? 0}
            suffix="%"
            description={`${data.automation_health?.overall.total_launches ?? 0} launches`}
            trend={isComparing ? calculateTrend(data.automation_health?.overall.pass_rate_pct ?? 0, compareData?.automation_health?.overall.pass_rate_pct ?? undefined) : undefined}
            color={(data.automation_health?.overall.pass_rate_pct ?? 0) >= 90 ? "success" : (data.automation_health?.overall.pass_rate_pct ?? 0) >= 75 ? "warning" : "error"}
          />
          <KPICard
            title="Story Points"
            scrollTo="velocity"
            tooltip="Story points completed by the QA team this quarter. Sub-count shows points still in-progress. Source: Jira via DX."
            value={Math.round(data.story_points_completed)}
            description={`${Math.round(data.story_points_in_progress)} in progress`}
            trend={isComparing ? calculateTrend(data.story_points_completed, compareData?.story_points_completed) : undefined}
            color="primary"
          />
          <KPICard
            title="Reviews"
            scrollTo="review-activity"
            tooltip='Distinct (PR, reviewer) pairs in this quarter — i.e. how many times a QA reviewer touched a PR. A reviewer who comments three times on the same PR counts once. Excludes bot reviews.'
            value={data.total_reviews}
            description={periodLabel}
            trend={isComparing ? calculateTrend(data.total_reviews, compareData?.total_reviews) : undefined}
            color="success"
          />
          <KPICard
            title="Tickets Done"
            scrollTo="velocity"
            tooltip="Jira tickets the QA team resolved this quarter (any type, not just bugs)."
            value={data.tickets_completed}
            description={periodLabel}
            trend={isComparing ? calculateTrend(data.tickets_completed, compareData?.tickets_completed) : undefined}
            color="success"
          />
        </div>
      </section>

      {/* Velocity Section */}
      <section id="velocity" style={{ scrollMarginTop: "80px" }}>
        <SectionHeader title="Velocity & Delivery" badge="Quarterly" />
        <div className="grid grid-cols-1 gap-6">
          <Card>
            <div className="mb-4">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Weekly Velocity Trend</h3>
              <p className="text-xs text-[var(--text-muted)] mt-1">Story points completed per week</p>
            </div>
            {velocityTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={velocityTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="week" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <YAxis yAxisId="left" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="right" orientation="right" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip {...tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Bar yAxisId="left" dataKey="Points" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="Tickets" stroke="var(--chart-4)" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-[var(--text-muted)]">No velocity data available</div>
            )}
          </Card>
        </div>

      </section>

      {/* Quality & Defects */}
      <section id="quality-metrics" style={{ scrollMarginTop: "80px" }}>
        <SectionHeader title="Quality Metrics" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <div className="mb-4">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Defect Trend</h3>
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

          <Card>
            <div className="mb-4">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">PR Activity Trend</h3>
              <p className="text-xs text-[var(--text-muted)] mt-1">Pull requests opened and merged per week</p>
            </div>
            {prTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={prTrendData}>
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
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-[var(--text-muted)]">No PR trend data</div>
            )}
          </Card>
        </div>
      </section>

      {/* Automation Health (ReportPortal-sourced, branch=main only) */}
      <section id="automation-health" style={{ scrollMarginTop: "80px" }}>
        <SectionHeader
          title="Automation Health"
          badge="ReportPortal"
          subtitle={data.automation_health
            ? `${data.automation_health.overall.total_launches} launches · ${data.automation_health.overall.total_tests.toLocaleString()} tests · main branch`
            : undefined}
        />
        {!data.automation_health || data.automation_health.by_project.length === 0 ? (
          <Card className="text-center text-[var(--text-muted)] py-8">
            Automation metrics are still being snapshotted. Refresh in a minute.
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Pass Rate per project */}
            <Card>
              <div className="mb-4">
                <h3 className="text-base font-semibold text-[var(--text-primary)]">Pass Rate by Project</h3>
                <p className="text-xs text-[var(--text-muted)] mt-1">Target 90%</p>
              </div>
              {(() => {
                const lookup = makeMetricLookup(data.automation_health!.by_project);
                return (
                  <ResponsiveContainer width="100%" height={Math.max(280, data.automation_health!.by_project.length * 28)}>
                    <BarChart
                      data={data.automation_health!.by_project.map((p) => ({ name: p.project, "Pass %": p.pass_rate_pct }))}
                      layout="vertical"
                      margin={{ left: 10, right: 30 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                      <YAxis type="category" dataKey="name" stroke="var(--text-muted)" fontSize={10} width={170} tickLine={false} interval={0} />
                      <Tooltip content={makePassRateTooltip(lookup)} cursor={{ fill: "var(--bg-overlay)" }} />
                      <Bar dataKey="Pass %" radius={[0, 4, 4, 0]}>
                        {data.automation_health!.by_project.map((p, idx) => (
                          <Cell
                            key={idx}
                            fill={
                              p.pass_rate_pct >= 90
                                ? "var(--success-base)"
                                : p.pass_rate_pct >= 75
                                ? "var(--warning-base)"
                                : "var(--error-base)"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                );
              })()}
            </Card>

            {/* Avg Workflow Duration per project */}
            <Card>
              <div className="mb-4">
                <h3 className="text-base font-semibold text-[var(--text-primary)]">Avg Workflow Duration</h3>
                <p className="text-xs text-[var(--text-muted)] mt-1">Minutes per launch</p>
              </div>
              {(() => {
                const lookup = makeMetricLookup(data.automation_health!.by_project);
                return (
                  <ResponsiveContainer width="100%" height={Math.max(280, data.automation_health!.by_project.length * 28)}>
                    <BarChart
                      data={[...data.automation_health!.by_project]
                        .sort((a, b) => b.avg_duration_sec - a.avg_duration_sec)
                        .map((p) => ({ name: p.project, "Minutes": Math.round(p.avg_duration_sec / 60) }))}
                      layout="vertical"
                      margin={{ left: 10, right: 30 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
                      <XAxis type="number" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                      <YAxis type="category" dataKey="name" stroke="var(--text-muted)" fontSize={10} width={170} tickLine={false} interval={0} />
                      <Tooltip content={makeDurationTooltip(lookup)} cursor={{ fill: "var(--bg-overlay)" }} />
                      <Bar dataKey="Minutes" fill="var(--info-base)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                );
              })()}
            </Card>

            {/* Flaky Tests per project (only those with >=5 launches) */}
            <Card>
              <div className="mb-4">
                <h3 className="text-base font-semibold text-[var(--text-primary)]">Flaky Tests by Project</h3>
                <p className="text-xs text-[var(--text-muted)] mt-1">% alternating pass/fail · projects with ≥5 launches</p>
              </div>
              {(() => {
                const eligible = data.automation_health!.by_project.filter((p) => p.flaky_pct !== null);
                if (eligible.length === 0) {
                  return <div className="flex items-center justify-center h-[280px] text-[var(--text-muted)]">No projects with ≥5 launches yet</div>;
                }
                const sorted = [...eligible].sort((a, b) => (b.flaky_pct ?? 0) - (a.flaky_pct ?? 0));
                const lookup = makeMetricLookup(data.automation_health!.by_project);
                return (
                  <ResponsiveContainer width="100%" height={Math.max(280, sorted.length * 32)}>
                    <BarChart
                      data={sorted.map((p) => ({ name: p.project, "Flaky %": p.flaky_pct ?? 0 }))}
                      layout="vertical"
                      margin={{ left: 10, right: 30 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
                      <XAxis type="number" stroke="var(--text-muted)" fontSize={11} tickLine={false} unit="%" />
                      <YAxis type="category" dataKey="name" stroke="var(--text-muted)" fontSize={10} width={170} tickLine={false} interval={0} />
                      <Tooltip content={makeFlakyTooltip(lookup)} cursor={{ fill: "var(--bg-overlay)" }} />
                      <Bar dataKey="Flaky %" radius={[0, 4, 4, 0]}>
                        {sorted.map((p, idx) => {
                          const v = p.flaky_pct ?? 0;
                          return (
                            <Cell
                              key={idx}
                              fill={v <= 5 ? "var(--success-base)" : v <= 10 ? "var(--warning-base)" : "var(--error-base)"}
                            />
                          );
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                );
              })()}
            </Card>
          </div>
        )}
      </section>

      {/* Review Activity Trend (aggregate weekly) */}
      <section id="review-activity" style={{ scrollMarginTop: "80px" }}>
        <SectionHeader title="Review Activity" badge="Quarterly" />
        <Card>
          <div className="mb-4">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">Code Reviews per Week</h3>
            <p className="text-xs text-[var(--text-muted)] mt-1">Total reviews completed by the QA team</p>
          </div>
          {reviewTrendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
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
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-[var(--text-muted)]">No review trend data</div>
          )}
        </Card>
      </section>

      {/* Comparison Summary */}
      {isComparing && compareData && (
        <section className="rounded-2xl bg-gradient-to-br from-[var(--bg-elevated)] to-[var(--bg-surface)] border border-[var(--border-subtle)] p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Period Comparison Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1">Bug Delta</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-[var(--text-primary)]">
                  {(bugsData?.total ?? data.open_bugs) - (compareBugsData?.total ?? compareData.open_bugs)}
                </span>
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1">PR Delta</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-[var(--text-primary)]">
                  {data.prs_merged - compareData.prs_merged}
                </span>
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1">Points Delta</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-[var(--text-primary)]">
                  {Math.round(data.story_points_completed - compareData.story_points_completed)}
                </span>
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1">Review Delta</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-[var(--text-primary)]">
                  {data.total_reviews - compareData.total_reviews}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
