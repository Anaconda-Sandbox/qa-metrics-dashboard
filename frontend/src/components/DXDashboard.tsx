import { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface DXMetrics {
  dex_score: number | null;
  quality_score: number | null;
  ease_of_delivery: number | null;
  deep_work: number | null;
  build_and_test: number | null;
  code_maintainability: number | null;
  documentation: number | null;
  planning_process: number | null;
  cross_team_collaboration: number | null;
  incremental_delivery: number | null;
  ease_of_release: number | null;
  weekly_time_loss: number | null;
  ai_code_quality: number | null;
}

interface DORAMetrics {
  deployment_frequency: number | null;
  lead_time_for_changes: number | null;
  mean_time_to_recovery: number | null;
  change_failure_rate: number | null;
}

interface PRMetrics {
  total_prs: number;
  merged_prs: number;
  avg_open_to_merge_hours: number | null;
  avg_open_to_first_review_hours: number | null;
  avg_review_cycles: number | null;
  prs_by_week: Array<{ week: string; count: number; merged: number }>;
}

interface Snapshot {
  id: string;
  scheduled_for: string;
  completed_at: string | null;
  completed_count: number;
  total_count: number;
  response_rate: number;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  github_username: string | null;
  is_developer: boolean;
}

interface TeamInfo {
  id: string;
  name: string;
  manager_name: string;
  manager_email: string;
  contributor_count: number;
  members: TeamMember[];
}

interface QAScore {
  team_name: string;
  item_name: string;
  item_type: string;
  score: number | null;
  response_count: number;
  vs_prev: number | null;
  vs_org: number | null;
  vs_50th: number | null;
  vs_75th: number | null;
}

interface Benchmarks {
  [key: string]: {
    avg: number;
    min: number;
    max: number;
    count: number;
  };
}

interface ComparisonMetric {
  current: number | null;
  previous: number | null;
  change: number | null;
}

interface DXDashboardData {
  quarter: string;
  snapshot: Snapshot | null;
  metrics: DXMetrics;
  dora: DORAMetrics;
  pr_metrics: PRMetrics | null;
  team: TeamInfo | null;
  benchmarks: Benchmarks | null;
  qa_scores: QAScore[];
  comparison: {
    quarters: { current: string; previous: string };
    metrics: {
      dex_score: ComparisonMetric;
      quality_score: ComparisonMetric;
      ease_of_delivery: ComparisonMetric;
      deep_work: ComparisonMetric;
      build_and_test: ComparisonMetric;
    };
    snapshots: { current: Snapshot | null; previous: Snapshot | null };
    pr_metrics: { current: PRMetrics | null; previous: PRMetrics | null };
  } | null;
}

interface Props {
  quarter: string;
  compareQuarter: string | null;
}

export default function DXDashboard({ quarter, compareQuarter }: Props) {
  const [data, setData] = useState<DXDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ quarter });
        if (compareQuarter) {
          params.append("compare_quarter", compareQuarter);
        }
        const response = await fetch(`${API_BASE}/api/dx/dashboard?${params}`);
        if (!response.ok) throw new Error("Failed to fetch DX data");
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [quarter, compareQuarter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-[var(--text-muted)]">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Loading DX metrics...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-xl bg-[var(--error-subtle)] border border-[var(--error-base)]/30">
        <div className="flex items-center gap-3 text-[var(--error-base)]">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>Error loading DX data: {error}</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { metrics, dora, pr_metrics, snapshot, team, benchmarks, qa_scores, comparison } = data;

  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-[var(--text-muted)]";
    if (score >= 75) return "text-[var(--success-base)]";
    if (score >= 50) return "text-[var(--warning-base)]";
    return "text-[var(--error-base)]";
  };

  const getChangeIndicator = (change: number | null) => {
    if (change === null) return null;
    const isPositive = change > 0;
    return (
      <span className={`flex items-center gap-0.5 text-xs ${isPositive ? "text-[var(--success-base)]" : "text-[var(--error-base)]"}`}>
        {isPositive ? (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        ) : (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        )}
        {Math.abs(change).toFixed(1)}%
      </span>
    );
  };

  const renderMetricCard = (
    title: string,
    value: number | null,
    subtitle?: string,
    comparisonData?: ComparisonMetric,
    benchmark?: { avg: number }
  ) => (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">{title}</span>
        {comparisonData && getChangeIndicator(comparisonData.change)}
      </div>
      <div className="flex items-end gap-2">
        <span className={`text-3xl font-bold ${getScoreColor(value)}`}>
          {value !== null ? value : "—"}
        </span>
        {value !== null && <span className="text-sm text-[var(--text-muted)] mb-1">/100</span>}
      </div>
      {subtitle && <p className="text-xs text-[var(--text-muted)] mt-2">{subtitle}</p>}
      {benchmark && value !== null && (
        <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--text-muted)]">Org avg</span>
            <span className={value > benchmark.avg ? "text-[var(--success-base)]" : "text-[var(--text-secondary)]"}>
              {benchmark.avg} {value > benchmark.avg ? "↑" : ""}
            </span>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Header with Snapshot Info */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">Developer Experience</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            DX metrics for QA team • {quarter}
            {comparison && ` vs ${comparison.quarters.previous}`}
          </p>
        </div>
        {snapshot && (
          <div className="card px-4 py-3">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-xs text-[var(--text-muted)]">Survey Response</p>
                <p className="text-lg font-semibold text-[var(--text-primary)]">
                  {snapshot.response_rate}%
                </p>
              </div>
              <div className="h-8 w-px bg-[var(--border-subtle)]" />
              <div>
                <p className="text-xs text-[var(--text-muted)]">Responses</p>
                <p className="text-lg font-semibold text-[var(--text-primary)]">
                  {snapshot.completed_count}/{snapshot.total_count}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Key DX Metrics */}
      <section>
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-[var(--accent-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Key Performance Indicators
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {renderMetricCard(
            "Quality",
            metrics.quality_score,
            "Code quality perception",
            comparison?.metrics.quality_score,
            benchmarks?.["Quality"]
          )}
          {renderMetricCard(
            "Ease of Delivery",
            metrics.ease_of_delivery,
            "How easy it is to ship code",
            comparison?.metrics.ease_of_delivery,
            benchmarks?.["Ease of delivery"]
          )}
          {renderMetricCard(
            "Deep Work",
            metrics.deep_work,
            "Uninterrupted focus time",
            comparison?.metrics.deep_work,
            benchmarks?.["Deep work"]
          )}
          {renderMetricCard(
            "Build & Test",
            metrics.build_and_test,
            "CI/CD experience",
            comparison?.metrics.build_and_test,
            benchmarks?.["Build and test"]
          )}
          {renderMetricCard(
            "Weekly Time Loss",
            metrics.weekly_time_loss,
            "Hours lost to friction",
            undefined,
            benchmarks?.["Weekly time loss"]
          )}
        </div>
      </section>

      {/* Detailed Factors */}
      <section>
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-[var(--info-base)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
          </svg>
          Contributing Factors
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {renderMetricCard("Code Maintainability", metrics.code_maintainability)}
          {renderMetricCard("Documentation", metrics.documentation)}
          {renderMetricCard("Planning Process", metrics.planning_process)}
          {renderMetricCard("Cross-Team Collab", metrics.cross_team_collaboration)}
          {renderMetricCard("Incremental Delivery", metrics.incremental_delivery)}
          {renderMetricCard("Ease of Release", metrics.ease_of_release)}
        </div>
      </section>

      {/* AI Code Quality */}
      {metrics.ai_code_quality !== null && (
        <section>
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-[var(--accent-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            AI Coding Experience
          </h3>
          <div className="card p-6">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">AI Code Quality Score</p>
                <span className={`text-4xl font-bold ${getScoreColor(metrics.ai_code_quality)}`}>
                  {metrics.ai_code_quality}
                </span>
                <span className="text-lg text-[var(--text-muted)]">/100</span>
              </div>
              <div className="flex-1 pl-6 border-l border-[var(--border-subtle)]">
                <p className="text-sm text-[var(--text-secondary)]">
                  Measures team satisfaction with AI-generated code quality, including accuracy,
                  relevance, and how well AI suggestions fit into existing codebases.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* DORA Metrics */}
      <section>
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-[var(--warning-base)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          DORA Metrics
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-5">
            <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Deployment Frequency
            </p>
            <span className="text-2xl font-bold text-[var(--text-primary)]">
              {dora.deployment_frequency !== null ? `${dora.deployment_frequency}/week` : "—"}
            </span>
            <p className="text-xs text-[var(--text-muted)] mt-2">Deploys per week</p>
          </div>
          <div className="card p-5">
            <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Lead Time
            </p>
            <span className="text-2xl font-bold text-[var(--text-primary)]">
              {dora.lead_time_for_changes !== null ? `${dora.lead_time_for_changes}d` : "—"}
            </span>
            <p className="text-xs text-[var(--text-muted)] mt-2">Days from commit to deploy</p>
          </div>
          <div className="card p-5">
            <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">
              MTTR
            </p>
            <span className="text-2xl font-bold text-[var(--text-muted)]">
              {dora.mean_time_to_recovery !== null ? `${dora.mean_time_to_recovery}h` : "—"}
            </span>
            <p className="text-xs text-[var(--text-muted)] mt-2">Mean time to recovery</p>
          </div>
          <div className="card p-5">
            <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Change Failure Rate
            </p>
            <span className="text-2xl font-bold text-[var(--text-muted)]">
              {dora.change_failure_rate !== null ? `${dora.change_failure_rate}%` : "—"}
            </span>
            <p className="text-xs text-[var(--text-muted)] mt-2">% of deployments causing failure</p>
          </div>
        </div>
      </section>

      {/* PR Metrics */}
      {pr_metrics && (
        <section>
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-[var(--success-base)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Pull Request Metrics
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="card p-5">
              <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">Total PRs</p>
              <span className="text-2xl font-bold text-[var(--text-primary)]">{pr_metrics.total_prs}</span>
              {comparison?.pr_metrics?.previous && (
                <p className="text-xs text-[var(--text-muted)] mt-2">
                  vs {comparison.pr_metrics.previous.total_prs} prev
                </p>
              )}
            </div>
            <div className="card p-5">
              <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">Merged PRs</p>
              <span className="text-2xl font-bold text-[var(--success-base)]">{pr_metrics.merged_prs}</span>
              <p className="text-xs text-[var(--text-muted)] mt-2">
                {pr_metrics.total_prs > 0
                  ? `${((pr_metrics.merged_prs / pr_metrics.total_prs) * 100).toFixed(0)}% merge rate`
                  : "—"}
              </p>
            </div>
            <div className="card p-5">
              <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">Avg Time to Merge</p>
              <span className="text-2xl font-bold text-[var(--text-primary)]">
                {pr_metrics.avg_open_to_merge_hours !== null
                  ? `${pr_metrics.avg_open_to_merge_hours.toFixed(1)}h`
                  : "—"}
              </span>
            </div>
            <div className="card p-5">
              <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">Time to First Review</p>
              <span className="text-2xl font-bold text-[var(--text-primary)]">
                {pr_metrics.avg_open_to_first_review_hours !== null
                  ? `${pr_metrics.avg_open_to_first_review_hours.toFixed(1)}h`
                  : "—"}
              </span>
            </div>
            <div className="card p-5">
              <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">Avg Review Cycles</p>
              <span className="text-2xl font-bold text-[var(--text-primary)]">
                {pr_metrics.avg_review_cycles !== null
                  ? pr_metrics.avg_review_cycles.toFixed(1)
                  : "—"}
              </span>
            </div>
          </div>

          {/* PR Weekly Chart */}
          {pr_metrics.prs_by_week.length > 0 && (
            <div className="card p-6 mt-4">
              <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-4">PRs by Week</h4>
              <div className="flex items-end gap-1 h-32">
                {pr_metrics.prs_by_week.map((week, idx) => {
                  const maxCount = Math.max(...pr_metrics.prs_by_week.map(w => w.count));
                  const height = maxCount > 0 ? (week.count / maxCount) * 100 : 0;
                  const mergedHeight = maxCount > 0 ? (week.merged / maxCount) * 100 : 0;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full relative" style={{ height: `${height}%`, minHeight: "4px" }}>
                        <div
                          className="absolute bottom-0 w-full bg-[var(--accent-primary)]/30 rounded-t"
                          style={{ height: "100%" }}
                        />
                        <div
                          className="absolute bottom-0 w-full bg-[var(--accent-primary)] rounded-t"
                          style={{ height: `${(mergedHeight / height) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)] truncate w-full text-center">
                        {week.count}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-center gap-4 mt-3 text-xs text-[var(--text-muted)]">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-[var(--accent-primary)]/30" />
                  Total
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-[var(--accent-primary)]" />
                  Merged
                </span>
              </div>
            </div>
          )}
        </section>
      )}

      {/* QA Team Scores Table */}
      {qa_scores.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-[var(--accent-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            QA Team Detailed Scores
          </h3>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--bg-elevated)]">
                  <th className="text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider px-4 py-3">Metric</th>
                  <th className="text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider px-4 py-3">Type</th>
                  <th className="text-right text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider px-4 py-3">Score</th>
                  <th className="text-right text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider px-4 py-3">vs Prev</th>
                  <th className="text-right text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider px-4 py-3">vs Org</th>
                  <th className="text-right text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider px-4 py-3">vs 50th</th>
                  <th className="text-right text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider px-4 py-3">Responses</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {qa_scores.map((score, idx) => (
                  <tr key={idx} className="hover:bg-[var(--bg-elevated)]/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-[var(--text-primary)] font-medium">{score.item_name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        score.item_type === "kpi"
                          ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]"
                          : "bg-[var(--text-muted)]/10 text-[var(--text-muted)]"
                      }`}>
                        {score.item_type}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right text-sm font-semibold ${getScoreColor(score.score)}`}>
                      {score.score !== null ? score.score : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      {score.vs_prev !== null ? (
                        <span className={score.vs_prev > 0 ? "text-[var(--success-base)]" : score.vs_prev < 0 ? "text-[var(--error-base)]" : "text-[var(--text-muted)]"}>
                          {score.vs_prev > 0 ? "+" : ""}{score.vs_prev}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      {score.vs_org !== null ? (
                        <span className={score.vs_org > 0 ? "text-[var(--success-base)]" : score.vs_org < 0 ? "text-[var(--error-base)]" : "text-[var(--text-muted)]"}>
                          {score.vs_org > 0 ? "+" : ""}{score.vs_org}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      {score.vs_50th !== null ? (
                        <span className={score.vs_50th > 0 ? "text-[var(--success-base)]" : score.vs_50th < 0 ? "text-[var(--error-base)]" : "text-[var(--text-muted)]"}>
                          {score.vs_50th > 0 ? "+" : ""}{score.vs_50th}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-[var(--text-muted)]">{score.response_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Team Info */}
      {team && (
        <section>
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-[var(--info-base)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            QA Team ({team.contributor_count} members)
          </h3>
          <div className="card p-5">
            <div className="flex items-center gap-4 mb-4 pb-4 border-b border-[var(--border-subtle)]">
              <div className="w-10 h-10 rounded-full bg-[var(--accent-primary)]/10 flex items-center justify-center">
                <span className="text-[var(--accent-primary)] font-semibold">
                  {team.manager_name.split(" ").map(n => n[0]).join("")}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">{team.manager_name}</p>
                <p className="text-xs text-[var(--text-muted)]">Team Manager</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {team.members.slice(0, 12).map((member) => (
                <div key={member.id} className="flex items-center gap-2 p-2 rounded-lg bg-[var(--bg-elevated)]/50">
                  <div className="w-8 h-8 rounded-full bg-[var(--bg-surface)] flex items-center justify-center text-xs font-medium text-[var(--text-muted)]">
                    {member.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-medium text-[var(--text-secondary)] truncate">{member.name.split(" ")[0]}</p>
                    {member.github_username && (
                      <p className="text-[10px] text-[var(--text-muted)] truncate">@{member.github_username}</p>
                    )}
                  </div>
                </div>
              ))}
              {team.members.length > 12 && (
                <div className="flex items-center justify-center p-2 rounded-lg bg-[var(--bg-elevated)]/50">
                  <span className="text-xs text-[var(--text-muted)]">+{team.members.length - 12} more</span>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
