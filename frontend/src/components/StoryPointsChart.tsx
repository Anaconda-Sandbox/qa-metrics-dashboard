import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  ComposedChart,
  Area,
} from "recharts";
import { API_BASE_URL } from "../config";

const api = axios.create({ baseURL: API_BASE_URL });

interface SprintVelocity {
  sprint_name: string;
  sprint_id: number;
  committed_points: number;
  completed_points: number;
  completion_rate: number;
  start_date: string | null;
  end_date: string | null;
}

interface MemberStoryPoints {
  username: string;
  jira_name: string;
  completed_points: number;
  in_progress_points: number;
  total_issues: number;
  issues_completed: number;
}

interface SprintInfo {
  id: number;
  name: string;
  state: string;
  start_date: string | null;
  end_date: string | null;
}

interface StoryPointsData {
  total_completed: number;
  total_in_progress: number;
  total_committed: number;
  velocity_trend: SprintVelocity[];
  by_member: MemberStoryPoints[];
  current_sprint: SprintInfo | null;
  avg_velocity: number;
}

function useStoryPoints(project: string | null, quarter: string | null) {
  return useQuery({
    queryKey: ["jira", "story-points", project, quarter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (project) params.append("project", project);
      if (quarter) params.append("quarter", quarter);
      const { data } = await api.get(`/jira/story-points?${params}`);
      return data as StoryPointsData;
    },
  });
}

export default function StoryPointsChart({ project, quarter }: { project: string | null; quarter?: string }) {
  const { data, isLoading, error } = useStoryPoints(project, quarter || null);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl bg-[#0f1419] border border-[#1e2a3a]/60 p-6">
          <div className="flex flex-col items-center justify-center py-6 space-y-3">
            <div className="relative">
              <div className="w-10 h-10 border-3 border-[#1e2a3a] rounded-full"></div>
              <div className="absolute top-0 left-0 w-10 h-10 border-3 border-transparent border-t-[#8b5cf6] rounded-full animate-spin"></div>
            </div>
            <p className="text-sm font-medium text-[#e2e8f0]">Loading story points...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-[#0f1419] border border-rose-500/20 p-6">
        <p className="text-sm text-rose-400">Failed to load story points data</p>
      </div>
    );
  }

  const hasData = data && (data.total_completed > 0 || data.total_in_progress > 0 || data.total_committed > 0);

  if (!hasData) {
    return (
      <div className="rounded-2xl bg-[#0f1419] border border-[#1e2a3a]/60 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-amber-500/10 rounded-lg">
            <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-[#e2e8f0]">Story Points Not Available</h3>
        </div>
        <p className="text-sm text-[#64748b] leading-relaxed">
          The selected projects don't have story points configured in Jira. Story point tracking requires
          tickets to have the "Story Points" field populated during sprint planning.
        </p>
        <div className="mt-4 p-3 bg-[#1e293b]/50 rounded-lg border border-[#1e2a3a]/40">
          <p className="text-xs text-[#94a3b8]">
            <span className="font-medium text-[#e2e8f0]">Tip:</span> To enable story point tracking, ensure your team
            estimates tickets using the Story Points field in Jira during sprint planning.
          </p>
        </div>
      </div>
    );
  }

  const velocityData = data?.velocity_trend?.map((v) => ({
    name: v.sprint_name.length > 15 ? v.sprint_name.slice(0, 15) + "..." : v.sprint_name,
    fullName: v.sprint_name,
    Committed: v.committed_points,
    Completed: v.completed_points,
    "Completion %": v.completion_rate,
  })) || [];

  const memberData = data?.by_member?.slice(0, 10).map((m) => ({
    name: m.username,
    Completed: m.completed_points,
    "In Progress": m.in_progress_points,
    Issues: m.total_issues,
  })) || [];

  const completionPercent = data?.total_committed
    ? Math.round((data.total_completed / data.total_committed) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="rounded-xl bg-[#0f1419] border border-[#1e2a3a]/60 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400">{data?.total_completed ?? 0}</p>
          <p className="text-[11px] text-[#64748b] mt-1">Completed Points</p>
        </div>
        <div className="rounded-xl bg-[#0f1419] border border-[#1e2a3a]/60 p-4 text-center">
          <p className="text-2xl font-bold text-amber-400">{data?.total_in_progress ?? 0}</p>
          <p className="text-[11px] text-[#64748b] mt-1">In Progress</p>
        </div>
        <div className="rounded-xl bg-[#0f1419] border border-[#1e2a3a]/60 p-4 text-center">
          <p className="text-2xl font-bold text-indigo-400">{data?.total_committed ?? 0}</p>
          <p className="text-[11px] text-[#64748b] mt-1">Committed</p>
        </div>
        <div className="rounded-xl bg-[#0f1419] border border-[#1e2a3a]/60 p-4 text-center">
          <p className="text-2xl font-bold text-cyan-400">{completionPercent}%</p>
          <p className="text-[11px] text-[#64748b] mt-1">Completion Rate</p>
        </div>
        <div className="rounded-xl bg-[#0f1419] border border-[#1e2a3a]/60 p-4 text-center">
          <p className="text-2xl font-bold text-purple-400">{data?.avg_velocity ?? 0}</p>
          <p className="text-[11px] text-[#64748b] mt-1">Avg Velocity</p>
        </div>
      </div>

      {/* Current Quarter Info */}
      {data?.current_sprint && (
        <div className="rounded-xl bg-[#0f1419] border border-[#1e2a3a]/60 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#e2e8f0]">{data.current_sprint.name}</p>
              <p className="text-xs text-[#64748b] mt-0.5">
                {data.current_sprint.start_date && new Date(data.current_sprint.start_date).toLocaleDateString()}
                {" - "}
                {data.current_sprint.end_date && new Date(data.current_sprint.end_date).toLocaleDateString()}
              </p>
            </div>
            <span className="px-3 py-1 text-xs font-medium bg-indigo-500/20 text-indigo-300 rounded-full border border-indigo-500/30">
              Current Quarter
            </span>
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Velocity Trend */}
        <div className="rounded-2xl bg-[#0f1419] border border-[#1e2a3a]/60 p-6">
          <h3 className="text-base font-semibold text-[#e2e8f0] mb-4">
            Weekly Velocity Trend
          </h3>
          {velocityData.length === 0 ? (
            <p className="text-sm text-[#64748b] text-center py-8">No velocity data available</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={velocityData}>
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  axisLine={{ stroke: "#1e2a3a" }}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  axisLine={{ stroke: "#1e2a3a" }}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  axisLine={{ stroke: "#1e2a3a" }}
                  tickLine={false}
                  domain={[0, 100]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelStyle={{ color: "#e2e8f0" }}
                />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Bar yAxisId="left" dataKey="Committed" fill="#6366f1" opacity={0.5} radius={[4, 4, 0, 0]} />
                <Bar yAxisId="left" dataKey="Completed" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="Completion %"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ fill: "#f59e0b", r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Story Points by Member */}
        <div className="rounded-2xl bg-[#0f1419] border border-[#1e2a3a]/60 p-6">
          <h3 className="text-base font-semibold text-[#e2e8f0] mb-4">
            Story Points by Member
          </h3>
          {memberData.length === 0 ? (
            <p className="text-sm text-[#64748b] text-center py-8">No member data available</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={memberData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <XAxis
                  type="number"
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  axisLine={{ stroke: "#1e2a3a" }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  axisLine={{ stroke: "#1e2a3a" }}
                  tickLine={false}
                  width={100}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelStyle={{ color: "#e2e8f0" }}
                />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Bar dataKey="Completed" stackId="a" fill="#10b981" radius={[0, 4, 4, 0]} />
                <Bar dataKey="In Progress" stackId="a" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Member Details Table */}
      {data?.by_member && data.by_member.length > 0 && (
        <div className="rounded-2xl bg-[#0f1419] border border-[#1e2a3a]/60 p-6">
          <h3 className="text-base font-semibold text-[#e2e8f0] mb-4">
            Member Story Points Details
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e2a3a]">
                  <th className="text-left py-2 px-3 text-[#64748b] font-medium">Member</th>
                  <th className="text-center py-2 px-3 text-[#64748b] font-medium">Completed</th>
                  <th className="text-center py-2 px-3 text-[#64748b] font-medium">In Progress</th>
                  <th className="text-center py-2 px-3 text-[#64748b] font-medium">Total Issues</th>
                  <th className="text-center py-2 px-3 text-[#64748b] font-medium">Issues Done</th>
                </tr>
              </thead>
              <tbody>
                {data.by_member.map((m) => (
                  <tr key={m.username} className="border-b border-[#1e2a3a]/40 hover:bg-[#1e293b]/30">
                    <td className="py-2 px-3">
                      <span className="font-medium text-[#e2e8f0]">{m.username}</span>
                      <span className="text-[10px] text-[#64748b] ml-2">({m.jira_name})</span>
                    </td>
                    <td className="text-center py-2 px-3 text-emerald-400 font-semibold">{m.completed_points}</td>
                    <td className="text-center py-2 px-3 text-amber-400">{m.in_progress_points}</td>
                    <td className="text-center py-2 px-3 text-[#94a3b8]">{m.total_issues}</td>
                    <td className="text-center py-2 px-3 text-cyan-400">{m.issues_completed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
