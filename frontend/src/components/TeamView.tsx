import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import InfoTip from "./InfoTip";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface AutomationProjectMetric {
  project: string;
  launches: number;
  pass_rate_pct: number;
  avg_duration_sec: number;
  flaky_pct: number | null;
  total_tests: number;
}

interface TeamData {
  team_contributions: Array<{ user_name: string; prs_opened: number; prs_merged: number }>;
  story_points_by_member: Array<{
    user_name: string;
    completed_points: number;
    in_progress_points: number;
    total_issues: number;
    issues_completed: number;
  }>;
  automation_health: {
    quarter: string;
    overall: { pass_rate_pct: number; avg_duration_sec: number; total_launches: number; total_tests: number };
    by_project: AutomationProjectMetric[];
  } | null;
}

interface Props {
  quarter: string;
  project: string;
}

// Build a project-name → metric lookup for richer chart tooltips.
function makeMetricLookup(items: AutomationProjectMetric[]): Record<string, AutomationProjectMetric> {
  const m: Record<string, AutomationProjectMetric> = {};
  for (const it of items) m[it.project] = it;
  return m;
}

// Recharts' Tooltip `content` prop is typed loosely; treat it as any
// and pull project name from payload[0].payload.name.
const tipBoxStyle: React.CSSProperties = {
  backgroundColor: "rgba(15, 20, 25, 0.95)",
  border: "1px solid rgba(71, 85, 105, 0.3)",
  borderRadius: 12,
  padding: "12px 16px",
  boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
  fontSize: 12,
};

function makePassRateTooltip(lookup: Record<string, AutomationProjectMetric>) {
  return (props: any) => {
    const { active, payload } = props || {};
    if (!active || !payload?.length) return null;
    const name = payload[0]?.payload?.name;
    const m = name ? lookup[name] : undefined;
    if (!m) return null;
    return (
      <div style={tipBoxStyle}>
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
      <div style={tipBoxStyle}>
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
      <div style={tipBoxStyle}>
        <div style={{ color: "#F1F5F9", fontWeight: 600, marginBottom: 6 }}>{m.project}</div>
        <div style={{ color, fontWeight: 700 }}>{v.toFixed(2)}% flaky</div>
        <div style={{ color: "#94a3b8", marginTop: 4 }}>tests alternating pass/fail · {m.launches} launches sampled</div>
      </div>
    );
  };
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

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-6 ${className}`}>
      {children}
    </div>
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

export default function TeamView({ quarter, project }: Props) {
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const projectQS = project && project !== "ALL" ? `&project=${encodeURIComponent(project)}` : "";
        const response = await fetch(`${API_BASE}/api/dx/executive?quarter=${quarter}${projectQS}`);
        if (!response.ok) throw new Error("Failed to fetch team metrics");
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [quarter, project]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center animate-pulse">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <p className="text-[var(--text-muted)]">Loading team metrics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="text-[var(--error-base)] font-medium">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const periodLabel = quarter.replace("-", " ");

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
        <div className="w-2 h-2 rounded-full bg-[var(--accent-primary)] animate-pulse" />
        <span>Per-member breakdowns</span>
        <span className="text-[var(--border-subtle)]">|</span>
        <span>{periodLabel}</span>
      </div>

      {/* Story Points by Member */}
      <section>
        <SectionHeader title="Story Points by Team Member" badge="Velocity" subtitle={periodLabel} />
        {data.story_points_by_member.length > 0 ? (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)]">
                    <th className="text-left py-3 px-4 text-[var(--text-muted)] font-medium">Member</th>
                    <th className="text-center py-3 px-4 text-[var(--text-muted)] font-medium">
                      <span className="inline-flex items-center gap-1.5 justify-center">
                        Completed
                        <InfoTip>Story points completed (assigned tickets resolved this quarter).</InfoTip>
                      </span>
                    </th>
                    <th className="text-center py-3 px-4 text-[var(--text-muted)] font-medium">
                      <span className="inline-flex items-center gap-1.5 justify-center">
                        In Progress
                        <InfoTip>Story points on tickets currently in progress (status not Done, not Closed).</InfoTip>
                      </span>
                    </th>
                    <th className="text-center py-3 px-4 text-[var(--text-muted)] font-medium">
                      <span className="inline-flex items-center gap-1.5 justify-center">
                        Total Tickets
                        <InfoTip>All tickets assigned to this member that touched the quarter (created or resolved within Q).</InfoTip>
                      </span>
                    </th>
                    <th className="text-center py-3 px-4 text-[var(--text-muted)] font-medium">
                      <span className="inline-flex items-center gap-1.5 justify-center">
                        Tickets Done
                        <InfoTip>Tickets this member resolved this quarter (resolutiondate set).</InfoTip>
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.story_points_by_member.map((m) => (
                    <tr key={m.user_name} className="border-b border-[var(--border-subtle)]/40 hover:bg-[var(--bg-surface)]/50 transition-colors">
                      <td className="py-3 px-4 font-medium text-[var(--text-primary)]">{m.user_name}</td>
                      <td className="text-center py-3 px-4 text-[var(--success-base)] font-semibold">{Math.round(m.completed_points)}</td>
                      <td className="text-center py-3 px-4 text-[var(--warning-base)]">{Math.round(m.in_progress_points)}</td>
                      <td className="text-center py-3 px-4 text-[var(--text-tertiary)]">{m.total_issues}</td>
                      <td className="text-center py-3 px-4 text-[var(--info-base)]">{m.issues_completed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <Card className="text-center text-[var(--text-muted)]">No story-point data for this quarter.</Card>
        )}
      </section>

      {/* PR Contributions */}
      <section>
        <SectionHeader title="PR Contributions" badge="Code Activity" subtitle={`${data.team_contributions.length} active members`} />
        {data.team_contributions.length > 0 ? (
          <Card>
            <ResponsiveContainer width="100%" height={Math.max(320, data.team_contributions.length * 40)}>
              <BarChart data={data.team_contributions} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
                <XAxis type="number" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                <YAxis type="category" dataKey="user_name" stroke="var(--text-muted)" fontSize={11} width={180} tickLine={false} interval={0} />
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar dataKey="prs_opened" name="Opened" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
                <Bar dataKey="prs_merged" name="Merged" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        ) : (
          <Card className="text-center text-[var(--text-muted)]">No PR activity for this quarter.</Card>
        )}
      </section>

      {/* Automation Health (ReportPortal-sourced, branch=main only) */}
      <section>
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
    </div>
  );
}
