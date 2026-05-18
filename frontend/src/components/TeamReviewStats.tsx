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
} from "recharts";
import { API_BASE_URL } from "../config";

const api = axios.create({ baseURL: API_BASE_URL });

interface ReviewerStats {
  username: string;
  reviews_given: number;
  approvals: number;
  changes_requested: number;
  comments: number;
}

interface WeeklyTrend {
  week: string;
  reviewed: number;
}

interface TeamReviewStats {
  total_reviews: number;
  copilot_reviews: number;
  human_reviews: number;
  reviewers: ReviewerStats[];
  weekly_trend: WeeklyTrend[];
}

function useTeamReviewStats(squad: string | null, days: number = 30) {
  return useQuery({
    queryKey: ["github", "team-review-stats", squad, days],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (squad) params.append("squad", squad);
      params.append("days", String(days));
      const { data } = await api.get(`/github/team-review-stats?${params}`);
      return data as TeamReviewStats;
    },
  });
}

export default function TeamReviewStats({ squad }: { squad: string | null }) {
  const { data, isLoading, error } = useTeamReviewStats(squad);

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Loading Header */}
        <div className="rounded-2xl bg-[#0f1419] border border-[#1e2a3a]/60 p-6">
          <div className="flex flex-col items-center justify-center py-4 space-y-3">
            <div className="relative">
              <div className="w-10 h-10 border-3 border-[#1e2a3a] rounded-full"></div>
              <div className="absolute top-0 left-0 w-10 h-10 border-3 border-transparent border-t-[#06b6d4] rounded-full animate-spin"></div>
            </div>
            <p className="text-sm font-medium text-[#e2e8f0]">Loading review stats...</p>
          </div>
        </div>
        {/* Skeleton Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-[#0f1419] border border-[#1e2a3a]/60 p-4 animate-pulse">
              <div className="h-8 bg-[#1e2a3a]/60 rounded w-1/2 mx-auto mb-2"></div>
              <div className="h-3 bg-[#1e2a3a]/40 rounded w-3/4 mx-auto"></div>
            </div>
          ))}
        </div>
        {/* Skeleton Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-[#0f1419] border border-[#1e2a3a]/60 p-6 animate-pulse">
              <div className="h-5 bg-[#1e2a3a]/60 rounded w-1/3 mb-4"></div>
              <div className="h-[250px] bg-[#1e2a3a]/40 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-[#0f1419] border border-rose-500/20 p-6">
        <p className="text-sm text-rose-400">Failed to load review stats</p>
      </div>
    );
  }

  const truncateName = (name: string, maxLen: number = 20) => {
    if (name.length <= maxLen) return name;
    if (name.includes("[bot]")) {
      const botPart = name.replace("[bot]", "").slice(0, maxLen - 6) + "...[bot]";
      return botPart;
    }
    return name.slice(0, maxLen - 3) + "...";
  };

  const reviewerData = data?.reviewers?.slice(0, 10).map((r) => ({
    name: truncateName(r.username),
    fullName: r.username,
    Approved: r.approvals,
    "Changes Requested": r.changes_requested,
    Commented: r.comments,
  })) || [];

  const trendData = data?.weekly_trend?.map((t) => ({
    week: t.week.replace(/^\d{4}-W/, "W"),
    reviews: t.reviewed,
  })) || [];

  const copilotPercent = data?.total_reviews
    ? Math.round((data.copilot_reviews / data.total_reviews) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-[#0f1419] border border-[#1e2a3a]/60 p-4 text-center">
          <p className="text-2xl font-bold text-cyan-400">{data?.total_reviews ?? 0}</p>
          <p className="text-[11px] text-[#64748b] mt-1">Total Reviews (30d)</p>
        </div>
        <div className="rounded-xl bg-[#0f1419] border border-[#1e2a3a]/60 p-4 text-center">
          <p className="text-2xl font-bold text-indigo-400">{data?.human_reviews ?? 0}</p>
          <p className="text-[11px] text-[#64748b] mt-1">Human Reviews</p>
        </div>
        <div className="rounded-xl bg-[#0f1419] border border-[#1e2a3a]/60 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400">{data?.copilot_reviews ?? 0}</p>
          <p className="text-[11px] text-[#64748b] mt-1">AI Reviews</p>
        </div>
        <div className="rounded-xl bg-[#0f1419] border border-[#1e2a3a]/60 p-4 text-center">
          <p className="text-2xl font-bold text-amber-400">{copilotPercent}%</p>
          <p className="text-[11px] text-[#64748b] mt-1">AI Coverage</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Review Trend */}
        <div className="rounded-2xl bg-[#0f1419] border border-[#1e2a3a]/60 p-6">
          <h3 className="text-base font-semibold text-[#e2e8f0] mb-4">
            Weekly Review Trend
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={trendData}>
              <XAxis
                dataKey="week"
                tick={{ fill: "#64748b", fontSize: 11 }}
                axisLine={{ stroke: "#1e2a3a" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 11 }}
                axisLine={{ stroke: "#1e2a3a" }}
                tickLine={false}
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
              <Line
                type="monotone"
                dataKey="reviews"
                stroke="#06b6d4"
                strokeWidth={2}
                dot={{ fill: "#06b6d4", r: 4 }}
                name="Reviews"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top Reviewers */}
        <div className="rounded-2xl bg-[#0f1419] border border-[#1e2a3a]/60 p-6">
          <h3 className="text-base font-semibold text-[#e2e8f0] mb-4">
            Top Reviewers
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={reviewerData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
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
                width={220}
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
              <Bar dataKey="Approved" stackId="a" fill="#10b981" />
              <Bar dataKey="Changes Requested" stackId="a" fill="#f59e0b" />
              <Bar dataKey="Commented" stackId="a" fill="#64748b" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Reviewer Table */}
      <div className="rounded-2xl bg-[#0f1419] border border-[#1e2a3a]/60 p-6">
        <h3 className="text-base font-semibold text-[#e2e8f0] mb-4">
          All Reviewers
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e2a3a]">
                <th className="text-left py-2 px-3 text-[#64748b] font-medium">Reviewer</th>
                <th className="text-center py-2 px-3 text-[#64748b] font-medium">Total</th>
                <th className="text-center py-2 px-3 text-[#64748b] font-medium">Approved</th>
                <th className="text-center py-2 px-3 text-[#64748b] font-medium">Changes</th>
                <th className="text-center py-2 px-3 text-[#64748b] font-medium">Comments</th>
              </tr>
            </thead>
            <tbody>
              {data?.reviewers?.map((r) => (
                <tr key={r.username} className="border-b border-[#1e2a3a]/40 hover:bg-[#1e293b]/30">
                  <td className="py-2 px-3">
                    <span className={`font-medium ${
                      r.username.toLowerCase().includes("copilot") || r.username.toLowerCase().includes("claude") || r.username.toLowerCase().includes("[bot]")
                        ? "text-emerald-400"
                        : "text-[#e2e8f0]"
                    }`}>
                      {r.username}
                      {(r.username.toLowerCase().includes("copilot") || r.username.toLowerCase().includes("claude") || r.username.toLowerCase().includes("[bot]")) && (
                        <span className="ml-2 text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">
                          AI
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="text-center py-2 px-3 text-cyan-400 font-semibold">{r.reviews_given}</td>
                  <td className="text-center py-2 px-3 text-emerald-400">{r.approvals}</td>
                  <td className="text-center py-2 px-3 text-amber-400">{r.changes_requested}</td>
                  <td className="text-center py-2 px-3 text-slate-400">{r.comments}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
