import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useDefectDensity } from "../hooks/useMetrics";

const PROJECT_COLORS = ["#6366f1", "#ec4899", "#06b6d4", "#f59e0b"];
const PRIORITY_COLORS: Record<string, string> = {
  Highest: "#f43f5e",
  High: "#f97316",
  Medium: "#6366f1",
  Low: "#10b981",
  Lowest: "#64748b",
};

interface Props {
  project: string | null;
  quarter?: string;
}

export default function DefectDensityChart({ project, quarter }: Props) {
  const { data, isLoading, error } = useDefectDensity(null, project, quarter);

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-[#0f1419] border border-[#1e2a3a]/60 p-6">
        <div className="flex flex-col items-center justify-center py-6 space-y-3">
          <div className="relative">
            <div className="w-8 h-8 border-2 border-[#1e2a3a] rounded-full"></div>
            <div className="absolute top-0 left-0 w-8 h-8 border-2 border-transparent border-t-[#6366f1] rounded-full animate-spin"></div>
          </div>
          <p className="text-xs text-[#64748b]">Loading defect data...</p>
        </div>
        <div className="animate-pulse grid grid-cols-2 gap-4">
          <div className="h-[200px] bg-[#1e2a3a]/40 rounded-xl"></div>
          <div className="h-[200px] bg-[#1e2a3a]/40 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl bg-[#0f1419] border border-[#1e2a3a]/60 p-6">
        <h3 className="text-sm font-medium text-[#64748b] mb-2">Defect Density</h3>
        <p className="text-sm text-[#f87171]">Failed to load: Jira</p>
      </div>
    );
  }

  const projectData = Object.entries(data.by_project || {}).map(
    ([name, value]) => ({ name, value })
  );
  const priorityData = Object.entries(data.by_priority || {}).map(
    ([name, value]) => ({ name, value })
  );

  return (
    <div className="rounded-2xl bg-[#0f1419] border border-[#1e2a3a]/60 p-6">
      <h3 className="text-base font-semibold text-[#e2e8f0] mb-1">
        Defect Density
      </h3>
      <p className="text-xs text-[#64748b] mb-4">Open bugs distribution</p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-[#64748b] mb-2 text-center font-medium">By Project</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={projectData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                strokeWidth={0}
              >
                {projectData.map((_, i) => (
                  <Cell key={i} fill={PROJECT_COLORS[i % PROJECT_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                labelStyle={{ color: "#e2e8f0" }}
              />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div>
          <p className="text-xs text-[#64748b] mb-2 text-center font-medium">By Priority</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={priorityData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                strokeWidth={0}
              >
                {priorityData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={PRIORITY_COLORS[entry.name] || "#64748b"}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                labelStyle={{ color: "#e2e8f0" }}
              />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
