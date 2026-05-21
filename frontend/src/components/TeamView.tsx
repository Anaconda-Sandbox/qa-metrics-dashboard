import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface TeamData {
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
}

interface Props {
  quarter: string;
  project: string;
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
                    <th className="text-center py-3 px-4 text-[var(--text-muted)] font-medium">Completed</th>
                    <th className="text-center py-3 px-4 text-[var(--text-muted)] font-medium">In Progress</th>
                    <th className="text-center py-3 px-4 text-[var(--text-muted)] font-medium">Total Issues</th>
                    <th className="text-center py-3 px-4 text-[var(--text-muted)] font-medium">Issues Done</th>
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
            <ResponsiveContainer width="100%" height={Math.max(300, data.team_contributions.length * 35)}>
              <BarChart data={data.team_contributions} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
                <XAxis type="number" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                <YAxis type="category" dataKey="user_name" stroke="var(--text-muted)" fontSize={11} width={140} tickLine={false} />
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

      {/* Top Reviewers */}
      <section>
        <SectionHeader title="Top Reviewers" badge="Code Reviews" subtitle="Code review activity breakdown" />
        {data.top_reviewers.length > 0 ? (
          <Card>
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
                  {data.top_reviewers.map((r) => (
                    <tr key={r.user_name} className="border-b border-[var(--border-subtle)]/40 hover:bg-[var(--bg-surface)]/50 transition-colors">
                      <td className="py-3 px-4 font-medium text-[var(--text-primary)]">{r.user_name}</td>
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
        ) : (
          <Card className="text-center text-[var(--text-muted)]">No review activity for this quarter.</Card>
        )}
      </section>
    </div>
  );
}
