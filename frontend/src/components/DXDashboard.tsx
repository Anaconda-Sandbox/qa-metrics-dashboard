import { useState, useEffect } from "react";
import InfoTip from "./InfoTip";

const API_BASE = import.meta.env.VITE_API_URL || "";

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
}

interface AIToolUsage {
  user_name: string;
  email: string;
  ai_tool: string;
  active_days: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_spend_dollars: number;
  last_active_date: string | null;
}

interface PRReviewStats {
  user_name: string;
  email: string;
  prs_authored: number;
  reviews_done: number;
  review_comments: number;
}

interface DefectDensityByProject {
  project_name: string;
  total_issues: number;
  bug_count: number;
  defect_density_pct: number;
}

interface QACloudMetrics {
  defect_density: number | null;
  bug_count_by_priority: Record<string, number>;
  bug_resolution_rate: number | null;
  reopen_rate: number | null;
  tickets_completed: number;
  cycle_time_avg_hours: number | null;
  backlog_size: number;
  pipeline_pass_rate: number | null;
  total_pipeline_runs: number;
  copilot_active_users: number;
  copilot_acceptance_rate: number | null;
  copilot_loc_suggested: number;
  copilot_loc_accepted: number;
  ai_tool_usage: AIToolUsage[];
  pr_review_stats: PRReviewStats[];
  defect_density_by_project: DefectDensityByProject[];
}

interface DXDashboardData {
  quarter: string;
  snapshot: Snapshot | null;
  metrics: DXMetrics;
  dora: DORAMetrics;
  team: TeamInfo | null;
  qa_scores: QAScore[];
  from_cache: boolean;
}

interface Props {
  quarter: string;
  compareQuarter: string | null;
}

// Metric Card Component
function MetricCard({
  label,
  value,
  unit = "",
  subtitle,
  trend,
  icon,
  variant = "default",
  tooltip,
}: {
  label: string;
  value: number | string | null;
  unit?: string;
  subtitle?: string;
  trend?: number | null;
  icon?: React.ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "accent";
  tooltip?: string;
}) {
  const variantClasses = {
    default: "",
    success: "metric-card-success",
    warning: "metric-card-warning",
    error: "metric-card-error",
    accent: "metric-card-accent"
  };

  const valueClasses = {
    default: "stat-value",
    success: "stat-value-success",
    warning: "stat-value-warning",
    error: "stat-value-error",
    accent: "stat-value-accent"
  };

  return (
    <div className={`card metric-card card-glow ${variantClasses[variant]}`}>
      <div className="flex items-start justify-between">
        <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
          {label}
          {tooltip && <InfoTip>{tooltip}</InfoTip>}
        </span>
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-[var(--bg-overlay)] flex items-center justify-center">
            {icon}
          </div>
        )}
      </div>
      <div className="flex items-end gap-2">
        <span className={valueClasses[variant]}>
          {value !== null ? value : "—"}
        </span>
        {unit && value !== null && (
          <span className="text-sm text-[var(--text-muted)] mb-1">{unit}</span>
        )}
      </div>
      {(subtitle || trend !== undefined) && (
        <div className="flex items-center justify-between mt-1">
          {subtitle && <span className="text-xs text-[var(--text-muted)]">{subtitle}</span>}
          {trend !== null && trend !== undefined && (
            <span className={`flex items-center gap-1 text-xs font-medium ${trend > 0 ? "text-[var(--success-base)]" : trend < 0 ? "text-[var(--error-base)]" : "text-[var(--text-muted)]"}`}>
              {trend > 0 ? "+" : ""}{trend}%
              {trend !== 0 && (
                <svg className={`w-3 h-3 ${trend < 0 ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                </svg>
              )}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Progress Score Component
function ScoreBar({ label, score, benchmark, tooltip }: { label: string; score: number | null; benchmark?: number; tooltip?: string }) {
  const getScoreColor = (s: number) => {
    if (s >= 80) return "var(--success-base)";
    if (s >= 60) return "var(--warning-base)";
    return "var(--error-base)";
  };

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-[var(--text-secondary)] w-40 truncate inline-flex items-center gap-1.5">
        {label}
        {tooltip && <InfoTip>{tooltip}</InfoTip>}
      </span>
      <div className="flex-1">
        <div className="progress-bar">
          <div
            className="progress-bar-fill"
            style={{
              width: `${score || 0}%`,
              background: score ? `linear-gradient(90deg, ${getScoreColor(score)}80, ${getScoreColor(score)})` : undefined
            }}
          />
        </div>
      </div>
      <span className={`text-sm font-bold w-12 text-right ${score && score >= 80 ? "text-[var(--success-base)]" : score && score >= 60 ? "text-[var(--warning-base)]" : "text-[var(--error-base)]"}`}>
        {score !== null ? score : "—"}
      </span>
      {benchmark !== undefined && (
        <span className="text-xs text-[var(--text-muted)] w-16">
          org: {benchmark}
        </span>
      )}
    </div>
  );
}

// Section Header Component
function SectionHeader({ title, icon, variant = "accent" }: { title: string; icon: React.ReactNode; variant?: "accent" | "success" | "warning" | "error" | "info" }) {
  return (
    <div className="section-header">
      <div className={`section-icon section-icon-${variant}`}>
        {icon}
      </div>
      <h3 className="text-lg font-bold text-[var(--text-primary)]">{title}</h3>
    </div>
  );
}

export default function DXDashboard({ quarter }: Props) {
  const [data, setData] = useState<DXDashboardData | null>(null);
  const [qaCloudMetrics, setQaCloudMetrics] = useState<QACloudMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [qaCloudLoading, setQaCloudLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch the DX dashboard payload and the Jira-sourced QA roster in parallel.
        // The roster overrides team.members so we always show the full 19-member group
        // from Jira, not whatever subset DX has ingested for the team.
        const [dxResp, rosterResp] = await Promise.all([
          fetch(`${API_BASE}/api/dx/dashboard?quarter=${quarter}`),
          fetch(`${API_BASE}/api/members/qa-team`),
        ]);
        if (!dxResp.ok) throw new Error("Failed to fetch DX data");
        const result = await dxResp.json();

        if (rosterResp.ok) {
          const roster = await rosterResp.json();
          // Translate Jira roster → DX TeamInfo shape so the existing card renders unchanged
          const members = (roster.members || []).map((m: { accountId?: string; displayName: string; email: string; github_handle: string | null }) => ({
            id: m.accountId || m.email,
            name: m.displayName,
            email: m.email,
            github_username: m.github_handle ?? null,
            is_developer: false,
          }));
          const managerName = roster.manager?.name || result.team?.manager_name || "QA Team";
          const managerEmail = roster.manager?.email || result.team?.manager_email || "";
          result.team = {
            id: result.team?.id || "qa-jira",
            name: result.team?.name || "QA Team",
            manager_name: managerName,
            manager_email: managerEmail,
            contributor_count: roster.count ?? members.length,
            members,
          };
        }
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [quarter]);

  useEffect(() => {
    const fetchQaCloudMetrics = async () => {
      setQaCloudLoading(true);
      try {
        const response = await fetch(`${API_BASE}/api/dx/qa-metrics?quarter=${quarter}`);
        if (response.ok) {
          const result = await response.json();
          setQaCloudMetrics(result);
        }
      } catch {
        // Silently fail
      } finally {
        setQaCloudLoading(false);
      }
    };
    fetchQaCloudMetrics();
  }, [quarter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center animate-pulse">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-[var(--text-muted)]">Loading DX metrics...</p>
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

  const { metrics, dora, snapshot, team, qa_scores } = data;

  // Get KPI scores for display
  const kpiScores = qa_scores.filter(s => s.item_type === "kpi");
  const factorScores = qa_scores.filter(s => s.item_type === "factor");

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)] text-display">
            Developer Experience
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            QA Team Metrics for {quarter}
            {data.from_cache && <span className="ml-2 badge badge-info">Cached</span>}
          </p>
        </div>
        {snapshot && (
          <div className="card px-5 py-3 flex items-center gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-[var(--success-base)]">{snapshot.response_rate}%</p>
              <p className="text-xs text-[var(--text-muted)]">Response Rate</p>
            </div>
            <div className="w-px h-10 bg-[var(--border-subtle)]" />
            <div className="text-center">
              <p className="text-2xl font-bold text-[var(--text-primary)]">{snapshot.completed_count}</p>
              <p className="text-xs text-[var(--text-muted)]">Responses</p>
            </div>
          </div>
        )}
      </div>

      {/* Key Performance Indicators */}
      <section>
        <SectionHeader
          title="Key Performance Indicators"
          icon={<svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
          variant="accent"
        />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <MetricCard label="Quality" value={metrics.quality_score} unit="/100" variant={metrics.quality_score && metrics.quality_score >= 80 ? "success" : "default"}
            tooltip="DX survey: how confident the team is in the quality of what they ship. Higher = fewer regressions, more trust in tests. 0–100." />
          <MetricCard label="Ease of Delivery" value={metrics.ease_of_delivery} unit="/100"
            tooltip="DX survey: how easy it is to ship a change end-to-end (review, deploy, iterate). 0–100." />
          <MetricCard label="Deep Work" value={metrics.deep_work} unit="/100"
            tooltip="DX survey factor: % of time the team spends in uninterrupted focused work. Lower = more meeting/context-switch overhead." />
          <MetricCard label="Build & Test" value={metrics.build_and_test} unit="/100" variant={metrics.build_and_test && metrics.build_and_test >= 90 ? "success" : "default"}
            tooltip="DX survey factor: how reliable and fast local builds + CI tests are. 0–100." />
          <MetricCard label="AI Code Quality" value={metrics.ai_code_quality} unit="/100" variant="accent"
            tooltip="DX survey factor: perceived quality of AI-assisted code (Copilot/Cursor/Claude). 0–100." />
        </div>
      </section>

      {/* Contributing Factors */}
      <section>
        <SectionHeader
          title="Contributing Factors"
          icon={<svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>}
          variant="info"
        />
        <div className="card p-6">
          <div className="space-y-4">
            <ScoreBar label="Code Maintainability" score={metrics.code_maintainability}
              tooltip="DX survey: how easy it is to read, modify, and extend code without introducing bugs. 0–100." />
            <ScoreBar label="Documentation" score={metrics.documentation}
              tooltip="DX survey: how complete, accurate, and discoverable internal docs are. 0–100." />
            <ScoreBar label="Planning Process" score={metrics.planning_process}
              tooltip="DX survey: clarity and effectiveness of sprint/quarter planning. 0–100." />
            <ScoreBar label="Cross-Team Collaboration" score={metrics.cross_team_collaboration}
              tooltip="DX survey: how well the team works with adjacent teams (handoffs, joint debugging, alignment). 0–100." />
            <ScoreBar label="Incremental Delivery" score={metrics.incremental_delivery}
              tooltip="DX survey: ability to break work into small, shippable slices and deploy them frequently. 0–100." />
            <ScoreBar label="Ease of Release" score={metrics.ease_of_release}
              tooltip="DX survey: how confident the team is in the release process — releases are routine, not events. 0–100." />
          </div>
        </div>
      </section>

      {/* QA Cloud Metrics */}
      <section>
        <SectionHeader
          title="Quality Metrics"
          icon={<svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          variant="error"
        />
        {qaCloudLoading ? (
          <div className="card p-8">
            <div className="flex items-center justify-center gap-3 text-[var(--text-muted)]">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Loading quality metrics from DX Data Cloud...</span>
            </div>
          </div>
        ) : qaCloudMetrics ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                label="Defect Density"
                value={qaCloudMetrics.defect_density}
                unit="%"
                subtitle="Bugs / Total tickets"
                variant={qaCloudMetrics.defect_density && qaCloudMetrics.defect_density <= 5 ? "success" : "warning"}
                tooltip="Org-wide bugs created in this quarter divided by all tickets created in the same window. Sourced from Jira (matches the per-project breakdown below)."
              />
              <MetricCard
                label="Resolution Rate"
                value={qaCloudMetrics.bug_resolution_rate}
                unit="%"
                subtitle="Bugs resolved"
                variant={qaCloudMetrics.bug_resolution_rate && qaCloudMetrics.bug_resolution_rate >= 80 ? "success" : "warning"}
                tooltip="Of bugs reported by QA in this quarter, the % already resolved. Same definition as the leadership Dashboard tile."
              />
              <MetricCard
                label="Cycle Time"
                value={qaCloudMetrics.cycle_time_avg_hours ? Math.round(qaCloudMetrics.cycle_time_avg_hours) : null}
                unit="hours"
                subtitle="Avg resolution time"
                tooltip="Average time from ticket creation to resolution for QA tickets resolved this quarter."
              />
              <MetricCard
                label="Backlog"
                value={qaCloudMetrics.backlog_size.toLocaleString()}
                subtitle="Open tickets"
                tooltip="Open Jira tickets assigned to the QA team across all projects. Includes bugs, stories, tasks."
              />
            </div>

            {/* Bug Priority Breakdown */}
            {Object.keys(qaCloudMetrics.bug_count_by_priority).length > 0 && (
              <div className="card p-6">
                <h4 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">Bugs by Priority</h4>
                <div className="flex items-end gap-4 h-32">
                  {Object.entries(qaCloudMetrics.bug_count_by_priority)
                    .sort((a, b) => {
                      const order = ["Highest", "High", "Medium", "Low", "Lowest"];
                      return order.indexOf(a[0]) - order.indexOf(b[0]);
                    })
                    .map(([priority, count]) => {
                      const maxCount = Math.max(...Object.values(qaCloudMetrics.bug_count_by_priority));
                      const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
                      const colors: Record<string, string> = {
                        Highest: "from-red-600 to-red-500",
                        High: "from-orange-600 to-orange-500",
                        Medium: "from-yellow-600 to-yellow-500",
                        Low: "from-blue-600 to-blue-500",
                        Lowest: "from-green-600 to-green-500",
                      };
                      return (
                        <div key={priority} className="flex-1 flex flex-col items-center gap-2">
                          <div
                            className={`w-full bg-gradient-to-t ${colors[priority] || "from-gray-600 to-gray-500"} rounded-t-lg transition-all duration-500`}
                            style={{ height: `${Math.max(height, 8)}%` }}
                          />
                          <div className="text-center">
                            <p className="text-lg font-bold text-[var(--text-primary)]">{count}</p>
                            <p className="text-xs text-[var(--text-muted)]">{priority}</p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </section>

      {/* Velocity & AI Adoption */}
      {qaCloudMetrics && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Velocity */}
          <section>
            <SectionHeader
              title="Velocity"
              icon={<svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
              variant="success"
            />
            <div className="card p-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center p-4 rounded-xl bg-[var(--bg-overlay)]">
                  <p className="text-3xl font-bold stat-value-success">{qaCloudMetrics.tickets_completed.toLocaleString()}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">Tickets Completed</p>
                </div>
                <div className="text-center p-4 rounded-xl bg-[var(--bg-overlay)]">
                  <p className="text-3xl font-bold text-[var(--text-primary)]">{qaCloudMetrics.backlog_size.toLocaleString()}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">Backlog Size</p>
                </div>
              </div>
            </div>
          </section>

          {/* AI Adoption */}
          <section>
            <SectionHeader
              title="AI Adoption"
              icon={<svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
              variant="accent"
            />
            <div className="card p-6">
              {qaCloudMetrics.copilot_active_users > 0 ? (
                <div className="grid grid-cols-2 gap-6">
                  <div className="text-center p-4 rounded-xl bg-[var(--bg-overlay)]">
                    <p className="text-3xl font-bold stat-value-accent">{qaCloudMetrics.copilot_active_users}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">Copilot Users</p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-[var(--bg-overlay)]">
                    <p className="text-3xl font-bold text-[var(--text-primary)]">{qaCloudMetrics.copilot_acceptance_rate || 0}%</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">Acceptance Rate</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-[var(--text-muted)]">
                  <p>No GitHub Copilot data available for this quarter</p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* AI Tool Usage Table */}
      {qaCloudMetrics && qaCloudMetrics.ai_tool_usage && qaCloudMetrics.ai_tool_usage.length > 0 && (
        <section>
          <SectionHeader
            title="AI Tool Usage by Team Member"
            icon={<svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
            variant="accent"
          />
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--bg-overlay)]">
                    <th className="text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider px-6 py-4">User</th>
                    <th className="text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider px-6 py-4">AI Tool</th>
                    <th className="text-right text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider px-6 py-4">Active Days</th>
                    <th className="text-right text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider px-6 py-4">Input Tokens</th>
                    <th className="text-right text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider px-6 py-4">Output Tokens</th>
                    <th className="text-right text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider px-6 py-4">Spend</th>
                    <th className="text-right text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider px-6 py-4">Last Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {qaCloudMetrics.ai_tool_usage.map((usage, idx) => (
                    <tr key={idx} className="hover:bg-[var(--bg-overlay)]/50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-[var(--text-primary)]">{usage.user_name}</p>
                          <p className="text-xs text-[var(--text-muted)]">{usage.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="badge badge-info">{usage.ai_tool}</span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-[var(--text-secondary)]">
                        {usage.active_days}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-[var(--text-secondary)]">
                        {usage.total_input_tokens.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-[var(--text-secondary)]">
                        {usage.total_output_tokens.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-semibold text-[var(--success-base)]">
                        ${usage.total_spend_dollars.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-[var(--text-muted)]">
                        {usage.last_active_date || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-[var(--bg-overlay)]">
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-sm font-semibold text-[var(--text-primary)]">
                      Total ({qaCloudMetrics.ai_tool_usage.length} records)
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-bold text-[var(--success-base)]">
                      ${qaCloudMetrics.ai_tool_usage.reduce((sum, u) => sum + u.total_spend_dollars, 0).toFixed(2)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* PR Review Activity moved to Team view (Top Reviewers section, Jira-anchored). */}

      {/* Defect Density by Project */}
      {qaCloudMetrics && qaCloudMetrics.defect_density_by_project && qaCloudMetrics.defect_density_by_project.length > 0 && (
        <section>
          <SectionHeader
            title="Defect Density by Project"
            icon={<svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
            variant="warning"
          />
          <div className="card p-6">
            <div className="space-y-4">
              {qaCloudMetrics.defect_density_by_project.map((project, idx) => {
                const getColor = (density: number) => {
                  if (density <= 5) return "var(--success-base)";
                  if (density <= 15) return "var(--warning-base)";
                  return "var(--error-base)";
                };
                const maxDensity = Math.max(...qaCloudMetrics.defect_density_by_project.map(p => p.defect_density_pct), 100);
                const barWidth = (project.defect_density_pct / maxDensity) * 100;

                return (
                  <div key={idx} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[var(--text-primary)]">{project.project_name}</span>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-[var(--text-muted)]">
                          {project.bug_count} bugs / {project.total_issues} tickets
                        </span>
                        <span
                          className="font-bold px-2 py-0.5 rounded"
                          style={{
                            color: getColor(project.defect_density_pct),
                            backgroundColor: `${getColor(project.defect_density_pct)}15`
                          }}
                        >
                          {project.defect_density_pct}%
                        </span>
                      </div>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${barWidth}%`,
                          background: `linear-gradient(90deg, ${getColor(project.defect_density_pct)}80, ${getColor(project.defect_density_pct)})`
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Detailed Scores Table */}
      {kpiScores.length > 0 && (
        <section>
          <SectionHeader
            title="Detailed QA Scores"
            icon={<svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>}
            variant="info"
          />
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--bg-overlay)]">
                    <th className="text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider px-6 py-4">Metric</th>
                    <th className="text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider px-6 py-4">Type</th>
                    <th className="text-right text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider px-6 py-4">Score</th>
                    <th className="text-right text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 justify-end">
                        vs Prev
                        <InfoTip placement="top" align="end">
                          Change vs the QA team's score in the previous DX survey snapshot. +4 means this score went up 4 points since last quarter.
                        </InfoTip>
                      </span>
                    </th>
                    <th className="text-right text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 justify-end">
                        vs Org
                        <InfoTip placement="top" align="end">
                          Difference from Anaconda's org-wide median for this metric. +5 means QA scores 5 points higher than the company average.
                        </InfoTip>
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {[...kpiScores, ...factorScores].map((score, idx) => (
                    <tr key={idx} className="hover:bg-[var(--bg-overlay)]/50 transition-colors">
                      <td className="px-6 py-4 text-sm text-[var(--text-primary)] font-medium">{score.item_name}</td>
                      <td className="px-6 py-4">
                        <span className={`badge ${score.item_type === "kpi" ? "badge-info" : "badge-warning"}`}>
                          {score.item_type}
                        </span>
                      </td>
                      <td className={`px-6 py-4 text-right text-sm font-bold ${score.score && score.score >= 80 ? "text-[var(--success-base)]" : score.score && score.score >= 60 ? "text-[var(--warning-base)]" : "text-[var(--error-base)]"}`}>
                        {score.score !== null ? score.score : "—"}
                      </td>
                      <td className="px-6 py-4 text-right text-sm">
                        {score.vs_prev !== null ? (
                          <span className={score.vs_prev > 0 ? "text-[var(--success-base)]" : score.vs_prev < 0 ? "text-[var(--error-base)]" : "text-[var(--text-muted)]"}>
                            {score.vs_prev > 0 ? "+" : ""}{score.vs_prev}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-6 py-4 text-right text-sm">
                        {score.vs_org !== null ? (
                          <span className={score.vs_org > 0 ? "text-[var(--success-base)]" : score.vs_org < 0 ? "text-[var(--error-base)]" : "text-[var(--text-muted)]"}>
                            {score.vs_org > 0 ? "+" : ""}{score.vs_org}
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Team Info */}
      {team && (
        <section>
          <SectionHeader
            title={`QA Team (${team.contributor_count} members)`}
            icon={<svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
            variant="accent"
          />
          <div className="card p-6">
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-[var(--border-subtle)]">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center text-white font-bold text-lg">
                {team.manager_name.split(" ").map(n => n[0]).join("")}
              </div>
              <div>
                <p className="text-lg font-semibold text-[var(--text-primary)]">{team.manager_name}</p>
                <p className="text-sm text-[var(--text-muted)]">Team Manager</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {team.members.map((member) => (
                <div key={member.id} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-overlay)] hover:bg-[var(--bg-surface)] transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-[var(--bg-surface)] flex items-center justify-center text-xs font-semibold text-[var(--text-muted)]">
                    {member.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div className="overflow-hidden flex-1">
                    <p className="text-sm font-medium text-[var(--text-secondary)] truncate">{member.name.split(" ")[0]}</p>
                    {member.github_username && (
                      <p className="text-xs text-[var(--text-muted)] truncate">@{member.github_username}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
