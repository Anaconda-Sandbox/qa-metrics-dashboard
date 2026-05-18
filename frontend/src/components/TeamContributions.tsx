import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useTeamContributions } from "../hooks/useMetrics";

const MEMBER_COLORS = [
  "#6366f1", "#ec4899", "#14b8a6", "#f59e0b", "#8b5cf6",
  "#06b6d4", "#f43f5e", "#10b981", "#3b82f6", "#a855f7",
];

interface Props {
  squad: string | null;
}

export default function TeamContributions({ squad }: Props) {
  const { data, isLoading, error } = useTeamContributions(squad, null, 30);

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-[#0f1419] border border-[#1e2a3a]/60 p-6">
        <div className="flex flex-col items-center justify-center py-8 space-y-3">
          <div className="relative">
            <div className="w-10 h-10 border-3 border-[#1e2a3a] rounded-full"></div>
            <div className="absolute top-0 left-0 w-10 h-10 border-3 border-transparent border-t-[#6366f1] rounded-full animate-spin"></div>
          </div>
          <p className="text-sm font-medium text-[#e2e8f0]">Loading team contributions...</p>
        </div>
        <div className="animate-pulse mt-4">
          <div className="h-[220px] bg-[#1e2a3a]/40 rounded-xl mb-6"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-[#1e293b]/40 border border-[#334155]/40 p-4">
                <div className="h-4 bg-[#334155]/40 rounded w-2/3 mb-3"></div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="h-8 bg-[#334155]/30 rounded"></div>
                  <div className="h-8 bg-[#334155]/30 rounded"></div>
                  <div className="h-8 bg-[#334155]/30 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl bg-[#0f1419] border border-[#1e2a3a]/60 p-6">
        <h3 className="text-sm font-medium text-[#64748b] mb-2">Team Contributions</h3>
        <p className="text-sm text-[#f87171]">Failed to load: GitHub</p>
      </div>
    );
  }

  const members = data.members || [];
  if (members.length === 0) {
    return (
      <div className="rounded-2xl bg-[#0f1419] border border-[#1e2a3a]/60 p-6">
        <h3 className="text-sm font-medium text-[#64748b] mb-2">Team Contributions</h3>
        <p className="text-sm text-[#64748b]">No QA team activity in the last 30 days</p>
      </div>
    );
  }

  const chartData = members.map((m: { username: string; prs_opened: number; prs_merged: number }) => ({
    name: m.username,
    Opened: m.prs_opened,
    Merged: m.prs_merged,
  }));

  return (
    <div className="rounded-2xl bg-[#0f1419] border border-[#1e2a3a]/60 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-base font-semibold text-[#e2e8f0]">
            QA Team Contributions
          </h3>
          <p className="text-xs text-[#64748b] mt-0.5">
            Last 30 days &middot; {data.total_prs} PRs total
          </p>
        </div>
        <div className="px-3 py-1 rounded-full bg-[#6366f1]/10 border border-[#6366f1]/20">
          <span className="text-xs font-medium text-[#a5b4fc]">
            {members.length} active members
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
          <XAxis type="number" stroke="#475569" fontSize={11} />
          <YAxis
            type="category"
            dataKey="name"
            stroke="#475569"
            fontSize={11}
            width={180}
            tick={{ fill: "#94a3b8" }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1e293b",
              border: "1px solid #334155",
              borderRadius: "8px",
            }}
            labelStyle={{ color: "#e2e8f0" }}
          />
          <Bar dataKey="Opened" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={14}>
            {chartData.map((_: unknown, i: number) => (
              <Cell key={i} fill={MEMBER_COLORS[i % MEMBER_COLORS.length]} opacity={0.7} />
            ))}
          </Bar>
          <Bar dataKey="Merged" fill="#4ade80" radius={[0, 4, 4, 0]} barSize={14}>
            {chartData.map((_: unknown, i: number) => (
              <Cell key={i} fill={MEMBER_COLORS[i % MEMBER_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Member detail cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-6">
        {members.map(
          (m: { username: string; prs_opened: number; prs_merged: number; avg_turnaround_hours: number; repos: Record<string, number> }, i: number) => (
            <div
              key={m.username}
              className="rounded-xl bg-[#1e293b]/40 border border-[#334155]/40 p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: MEMBER_COLORS[i % MEMBER_COLORS.length] }}
                />
                <span className="text-sm font-medium text-[#e2e8f0] truncate">
                  {m.username}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-[#e2e8f0]">{m.prs_opened}</p>
                  <p className="text-[10px] text-[#64748b]">opened</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-[#4ade80]">{m.prs_merged}</p>
                  <p className="text-[10px] text-[#64748b]">merged</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-[#f59e0b]">
                    {m.avg_turnaround_hours > 0 ? `${Math.round(m.avg_turnaround_hours)}h` : "—"}
                  </p>
                  <p className="text-[10px] text-[#64748b]">avg time</p>
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
