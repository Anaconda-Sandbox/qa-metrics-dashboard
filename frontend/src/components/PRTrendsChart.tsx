import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { usePRTrends } from "../hooks/useMetrics";

interface Props {
  squad: string | null;
}

export default function PRTrendsChart({ squad }: Props) {
  const { data, isLoading, error } = usePRTrends(squad);

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-[#0f1419] border border-[#1e2a3a]/60 p-6">
        <div className="flex flex-col items-center justify-center py-6 space-y-3">
          <div className="relative">
            <div className="w-8 h-8 border-2 border-[#1e2a3a] rounded-full"></div>
            <div className="absolute top-0 left-0 w-8 h-8 border-2 border-transparent border-t-[#6366f1] rounded-full animate-spin"></div>
          </div>
          <p className="text-xs text-[#64748b]">Loading PR trends...</p>
        </div>
        <div className="animate-pulse h-[220px] bg-[#1e2a3a]/40 rounded-xl"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl bg-[#0f1419] border border-[#1e2a3a]/60 p-6">
        <h3 className="text-sm font-medium text-[#64748b] mb-2">PR Trends</h3>
        <p className="text-sm text-[#f87171]">Failed to load: GitHub</p>
      </div>
    );
  }

  const chartData = (data.trends || []).map(
    (t: { week: string; opened: number; merged: number }) => ({
      week: t.week.replace(/^\d{4}-W/, "W"),
      Opened: t.opened,
      Merged: t.merged,
    })
  );

  if (chartData.length === 0) {
    return (
      <div className="rounded-2xl bg-[#0f1419] border border-[#1e2a3a]/60 p-6">
        <h3 className="text-sm font-medium text-[#64748b] mb-2">PR Trends</h3>
        <p className="text-sm text-[#64748b]">No QA team PR activity</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-[#0f1419] border border-[#1e2a3a]/60 p-6">
      <h3 className="text-base font-semibold text-[#e2e8f0] mb-1">
        QA Team PR Velocity
      </h3>
      <p className="text-xs text-[#64748b] mb-4">Last 12 weeks</p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData}>
          <XAxis dataKey="week" stroke="#475569" fontSize={10} />
          <YAxis stroke="#475569" fontSize={11} />
          <Tooltip
            contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
            labelStyle={{ color: "#e2e8f0" }}
          />
          <Legend wrapperStyle={{ fontSize: "11px" }} />
          <Line
            type="monotone"
            dataKey="Opened"
            stroke="#6366f1"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "#6366f1" }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="Merged"
            stroke="#10b981"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "#10b981" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
