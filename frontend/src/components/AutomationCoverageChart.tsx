import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useAutomationCoverage } from "../hooks/useMetrics";

const BAR_COLORS: Record<string, string> = {
  CLI: "#6366f1",
  API: "#ec4899",
  UI: "#14b8a6",
  GHA: "#f59e0b",
  Other: "#64748b",
};

const JIRA_BASE = "https://anaconda.atlassian.net/issues/";

// Build JQL for each test type
function buildJiraUrl(type: string, project: string | null): string {
  const projects = project && project !== "ALL" ? project : "SIR, PKG, AIC, PA, INST, PDA, AIP, CBR, BIG, DESK, TBP, CASH, AQUA, CLOUD, SHP, HUB, CLI";

  let labelFilter = "";
  if (type === "CLI") {
    labelFilter = 'AND labels in ("cli", "CLI", "cli-test", "cli-automation")';
  } else if (type === "API") {
    labelFilter = 'AND labels in ("api", "API", "api-test", "api-automation")';
  } else if (type === "UI") {
    labelFilter = 'AND labels in ("ui", "UI", "gui", "GUI", "ui-test", "ui-automation")';
  } else if (type === "GHA") {
    labelFilter = 'AND labels in ("gha", "GHA", "github-action", "github-actions")';
  } else if (type === "Other") {
    labelFilter = 'AND labels in ("Automated", "automation", "qa-automation") AND labels not in ("cli", "CLI", "api", "API", "ui", "UI", "gui", "GUI", "gha", "GHA", "github-action")';
  }

  const jql = `project in (${projects}) AND issuetype = Test AND labels in ("Automated", "automation", "qa-automation") ${labelFilter} ORDER BY created DESC`;
  return `${JIRA_BASE}?jql=${encodeURIComponent(jql)}`;
}

interface Props {
  project: string | null;
}

export default function AutomationCoverageChart({ project }: Props) {
  const { data, isLoading, error } = useAutomationCoverage(null, project);

  const handleBarClick = (type: string) => {
    const url = buildJiraUrl(type, project);
    window.open(url, "_blank");
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-[#0f1419] border border-[#1e2a3a]/60 p-6">
        <div className="flex flex-col items-center justify-center py-6 space-y-3">
          <div className="relative">
            <div className="w-8 h-8 border-2 border-[#1e2a3a] rounded-full"></div>
            <div className="absolute top-0 left-0 w-8 h-8 border-2 border-transparent border-t-[#14b8a6] rounded-full animate-spin"></div>
          </div>
          <p className="text-xs text-[#64748b]">Loading coverage data...</p>
        </div>
        <div className="animate-pulse flex items-center gap-6">
          <div className="w-28 h-28 bg-[#1e2a3a]/40 rounded-full flex-shrink-0"></div>
          <div className="flex-1 h-[180px] bg-[#1e2a3a]/40 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl bg-[#0f1419] border border-[#1e2a3a]/60 p-6">
        <h3 className="text-sm font-medium text-[#64748b] mb-2">Automation Coverage</h3>
        <p className="text-sm text-[#f87171]">Failed to load: Jira</p>
      </div>
    );
  }

  const chartData = Object.entries(data.by_type || {}).map(([name, value]) => ({
    name,
    count: value,
  }));

  const coverageColor =
    data.coverage_percentage >= 70
      ? "#10b981"
      : data.coverage_percentage >= 50
      ? "#f59e0b"
      : "#f43f5e";

  return (
    <div className="rounded-2xl bg-[#0f1419] border border-[#1e2a3a]/60 p-6">
      <h3 className="text-base font-semibold text-[#e2e8f0] mb-1">
        Automation Coverage
      </h3>
      <p className="text-xs text-[#64748b] mb-4">Test automation breakdown <span className="text-[#6366f1]">(click bars to view in Jira)</span></p>
      <div className="flex items-center gap-6">
        <div className="flex-shrink-0 text-center">
          <div className="relative inline-flex items-center justify-center">
            <svg className="w-28 h-28 -rotate-90">
              <circle cx="56" cy="56" r="48" fill="none" stroke="#1e293b" strokeWidth="8" />
              <circle
                cx="56" cy="56" r="48" fill="none"
                stroke={coverageColor}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${data.coverage_percentage * 3.01} 301.6`}
              />
            </svg>
            <span className="absolute text-2xl font-bold" style={{ color: coverageColor }}>
              {data.coverage_percentage}%
            </span>
          </div>
          <p className="text-xs text-[#64748b] mt-2">
            {data.automated_tickets} / {data.total_test_tickets}
          </p>
        </div>
        <div className="flex-1">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
              <XAxis type="number" stroke="#475569" fontSize={11} />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#475569"
                fontSize={11}
                width={50}
                tick={{ fill: "#94a3b8" }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                labelStyle={{ color: "#e2e8f0" }}
                formatter={(value: number, name: string) => [value, "Click to view in Jira"]}
              />
              <Bar
                dataKey="count"
                radius={[0, 6, 6, 0]}
                barSize={18}
                cursor="pointer"
                onClick={(data) => handleBarClick(data.name)}
              >
                {chartData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={BAR_COLORS[entry.name] || "#64748b"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
