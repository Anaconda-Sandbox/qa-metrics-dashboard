import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  useDefectDensity,
  useAutomationCoverage,
  useReportPortalStats,
  usePRStats,
  useFlakyTests,
} from "../hooks/useMetrics";
import KPICard from "./KPICard";

// PLACEHOLDER: replace with real data source
const quarterlyAutomation = [
  { quarter: "Q2 2025", coverage: 42 },
  { quarter: "Q3 2025", coverage: 51 },
  { quarter: "Q4 2025", coverage: 58 },
  { quarter: "Q1 2026", coverage: 67 },
];

// PLACEHOLDER: replace with real data source
const releaseData = [
  { quarter: "Q2 2025", days: 14 },
  { quarter: "Q3 2025", days: 11 },
  { quarter: "Q4 2025", days: 8 },
  { quarter: "Q1 2026", days: 5 },
];

interface AIROICardProps {
  bulletPoints?: string[];
}

function AIROICard({
  bulletPoints = [
    "58% token reduction in test generation (Q1 2026)",
    "~75% faster log triage via DSPy + AWS Bedrock",
    "Claude Code used for live PBP CLI bug fixes",
    "30+ automated test tickets via AI-assisted authoring",
  ],
}: AIROICardProps) {
  return (
    <div className="rounded-xl bg-[#161b27] border border-[#1e2a3a] p-6">
      <h3 className="text-lg font-semibold text-[#f1f5f9] mb-4">
        AI Tooling Impact
      </h3>
      <ul className="space-y-2">
        {bulletPoints.map((point, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-[#94a3b8]">
            <span className="text-[#4ade80] mt-0.5">&#9679;</span>
            {point}
          </li>
        ))}
      </ul>
      {/* PLACEHOLDER: Replace with actuals from usage-data/report.html */}
      <p className="text-xs text-[#94a3b8]/60 mt-4 italic">
        Replace with actuals from usage-data/report.html
      </p>
    </div>
  );
}

export default function ExecutiveView() {
  const { data: density, isLoading: densityLoading } = useDefectDensity();
  const { data: coverage, isLoading: coverageLoading } = useAutomationCoverage();
  const { data: rpStats, isLoading: rpLoading } = useReportPortalStats();
  const { data: prStats, isLoading: prLoading } = usePRStats();
  const { data: flaky, isLoading: flakyLoading } = useFlakyTests(10);

  const coveragePercent = coverage?.coverage_percentage ?? 0;
  const coverageColor =
    coveragePercent >= 70 ? "green" : coveragePercent >= 50 ? "yellow" : "red";

  const criticalBugs = density?.open_high_priority ?? 0;
  const avgPassRate = rpStats?.avg_pass_rate ?? 0;
  const passRateColor =
    avgPassRate >= 90 ? "green" : avgPassRate >= 75 ? "yellow" : "red";

  return (
    <div className="space-y-6">
      {/* Hero KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-xl bg-[#161b27] border border-[#1e2a3a] p-8 text-center">
          <p className="text-sm text-[#94a3b8] mb-2">Automation Coverage</p>
          {coverageLoading ? (
            <div className="animate-pulse h-12 bg-[#1e2a3a] rounded mx-auto w-24"></div>
          ) : (
            <>
              <p
                className="text-5xl font-bold"
                style={{
                  color:
                    coverageColor === "green"
                      ? "#4ade80"
                      : coverageColor === "yellow"
                      ? "#facc15"
                      : "#f87171",
                }}
              >
                {coveragePercent}%
              </p>
              <p className="text-xs text-[#94a3b8] mt-2">
                {coverage?.automated_tickets ?? 0} of{" "}
                {coverage?.total_test_tickets ?? 0} tests automated
              </p>
            </>
          )}
        </div>

        <div className="rounded-xl bg-[#161b27] border border-[#1e2a3a] p-8 text-center">
          <p className="text-sm text-[#94a3b8] mb-2">Open Critical Bugs</p>
          {densityLoading ? (
            <div className="animate-pulse h-12 bg-[#1e2a3a] rounded mx-auto w-24"></div>
          ) : (
            <>
              <p
                className={`text-5xl font-bold ${
                  criticalBugs > 5 ? "text-[#f87171]" : "text-[#facc15]"
                }`}
              >
                {criticalBugs}
              </p>
              <p className="text-xs text-[#94a3b8] mt-2">
                High + Highest priority
              </p>
            </>
          )}
        </div>

        <div className="rounded-xl bg-[#161b27] border border-[#1e2a3a] p-8 text-center">
          <p className="text-sm text-[#94a3b8] mb-2">Avg Pass Rate</p>
          {rpLoading ? (
            <div className="animate-pulse h-12 bg-[#1e2a3a] rounded mx-auto w-24"></div>
          ) : (
            <>
              <p
                className="text-5xl font-bold"
                style={{
                  color:
                    passRateColor === "green"
                      ? "#4ade80"
                      : passRateColor === "yellow"
                      ? "#facc15"
                      : "#f87171",
                }}
              >
                {avgPassRate}%
              </p>
              <p className="text-xs text-[#94a3b8] mt-2">
                Last {rpStats?.total_launches ?? 0} launches
              </p>
            </>
          )}
        </div>
      </div>

      {/* Trend Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl bg-[#161b27] border border-[#1e2a3a] p-6">
          <h3 className="text-sm font-medium text-[#94a3b8] mb-1">
            Automation Coverage Trend
          </h3>
          <p className="text-xs text-[#facc15] mb-4">
            Populate from quarterly snapshots
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={quarterlyAutomation}>
              <XAxis dataKey="quarter" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#161b27",
                  border: "1px solid #1e2a3a",
                }}
              />
              <Area
                type="monotone"
                dataKey="coverage"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl bg-[#161b27] border border-[#1e2a3a] p-6">
          <h3 className="text-sm font-medium text-[#94a3b8] mb-1">
            Release Turnaround (days)
          </h3>
          <p className="text-xs text-[#facc15] mb-4">
            Populate from PBP/PBC pipeline logs
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={releaseData}>
              <XAxis dataKey="quarter" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#161b27",
                  border: "1px solid #1e2a3a",
                }}
              />
              <Bar dataKey="days" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="PRs Merged This Month"
          value={prStats?.merged_prs_last_30d ?? "—"}
          color="blue"
          loading={prLoading}
        />
        <KPICard
          title="Bugs Closed This Month"
          value={density?.closed_bugs ?? "—"}
          color="green"
          loading={densityLoading}
        />
        <KPICard
          title="Test Runs This Month"
          value={rpStats?.total_tests_run ?? "—"}
          color="blue"
          loading={rpLoading}
        />
        <KPICard
          title="Flaky Tests"
          value={flaky?.total ?? "—"}
          color={
            (flaky?.total ?? 0) > 5
              ? "red"
              : (flaky?.total ?? 0) > 2
              ? "yellow"
              : "green"
          }
          loading={flakyLoading}
        />
      </div>

      {/* AI ROI */}
      <AIROICard />
    </div>
  );
}
