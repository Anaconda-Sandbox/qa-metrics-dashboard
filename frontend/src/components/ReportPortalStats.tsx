import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useLaunches } from "../hooks/useMetrics";

export default function ReportPortalStats() {
  const { data, isLoading, error } = useLaunches(10);

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-[#0f1419] border border-[#1e2a3a]/60 p-6">
        <div className="flex flex-col items-center justify-center py-6 space-y-3">
          <div className="relative">
            <div className="w-8 h-8 border-2 border-[#1e2a3a] rounded-full"></div>
            <div className="absolute top-0 left-0 w-8 h-8 border-2 border-transparent border-t-[#10b981] rounded-full animate-spin"></div>
          </div>
          <p className="text-xs text-[#64748b]">Loading test results...</p>
        </div>
        <div className="animate-pulse h-[220px] bg-[#1e2a3a]/40 rounded-xl"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl bg-[#0f1419] border border-[#1e2a3a]/60 p-6">
        <h3 className="text-sm font-medium text-[#64748b] mb-2">
          ReportPortal — Launch Results
        </h3>
        <p className="text-sm text-[#f87171]">Failed to load: ReportPortal</p>
      </div>
    );
  }

  const launches = data.launches || [];
  if (launches.length === 0) {
    return (
      <div className="rounded-2xl bg-[#0f1419] border border-[#1e2a3a]/60 p-6">
        <h3 className="text-sm font-medium text-[#64748b] mb-2">
          ReportPortal — Launch Results
        </h3>
        <p className="text-sm text-[#64748b]">No data available</p>
      </div>
    );
  }

  const chartData = [...launches].reverse().map(
    (l: { name: string; passed: number; failed: number; skipped: number }) => ({
      name: l.name.length > 12 ? l.name.slice(0, 12) + "..." : l.name,
      Passed: l.passed,
      Failed: l.failed,
      Skipped: l.skipped,
    })
  );

  return (
    <div className="rounded-2xl bg-[#0f1419] border border-[#1e2a3a]/60 p-6">
      <h3 className="text-base font-semibold text-[#e2e8f0] mb-1">
        Test Execution Results
      </h3>
      <p className="text-xs text-[#64748b] mb-4">Last 10 launches</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData}>
          <XAxis dataKey="name" stroke="#475569" fontSize={9} angle={-15} />
          <YAxis stroke="#475569" fontSize={11} />
          <Tooltip
            contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
            labelStyle={{ color: "#e2e8f0" }}
          />
          <Legend wrapperStyle={{ fontSize: "11px" }} />
          <Bar dataKey="Passed" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
          <Bar dataKey="Failed" stackId="a" fill="#f43f5e" />
          <Bar dataKey="Skipped" stackId="a" fill="#475569" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
