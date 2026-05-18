import { useFlakyTests } from "../hooks/useMetrics";

export default function FlakyTestsTable() {
  const { data, isLoading, error } = useFlakyTests(10);

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-[#0f1419] border border-[#1e2a3a]/60 p-6">
        <div className="flex flex-col items-center justify-center py-4 space-y-3">
          <div className="relative">
            <div className="w-8 h-8 border-2 border-[#1e2a3a] rounded-full"></div>
            <div className="absolute top-0 left-0 w-8 h-8 border-2 border-transparent border-t-[#facc15] rounded-full animate-spin"></div>
          </div>
          <p className="text-xs text-[#64748b]">Loading flaky tests...</p>
        </div>
        <div className="animate-pulse space-y-3 mt-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 bg-[#1e2a3a]/40 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl bg-[#0f1419] border border-[#1e2a3a]/60 p-6">
        <h3 className="text-base font-semibold text-[#e2e8f0] mb-2">
          Flaky Tests
        </h3>
        <p className="text-sm text-rose-400">Failed to load: ReportPortal</p>
      </div>
    );
  }

  const tests = data.tests || [];
  if (tests.length === 0) {
    return (
      <div className="rounded-2xl bg-[#0f1419] border border-[#1e2a3a]/60 p-6">
        <h3 className="text-base font-semibold text-[#e2e8f0] mb-2">
          Flaky Tests
        </h3>
        <p className="text-sm text-[#64748b]">No flaky tests detected</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-[#0f1419] border border-[#1e2a3a]/60 p-6 overflow-x-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-[#e2e8f0]">Flaky Tests</h3>
        <span className="text-xs text-[#64748b] bg-[#1e293b] px-2.5 py-1 rounded-full">
          Top {tests.length}
        </span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[#94a3b8] border-b border-[#1e2a3a]">
            <th className="pb-3 pr-4">Test Name</th>
            <th className="pb-3 pr-4">Failures</th>
            <th className="pb-3 pr-4">Total Runs</th>
            <th className="pb-3 pr-4">Flakiness Rate</th>
            <th className="pb-3">Last Seen</th>
          </tr>
        </thead>
        <tbody>
          {tests.map(
            (test: {
              name: string;
              failure_count: number;
              total_runs: number;
              flakiness_rate: number;
              last_seen: string;
            }) => (
              <tr
                key={test.name}
                className={`border-b border-[#1e2a3a]/50 hover:bg-[#1e2a3a]/30 ${
                  test.flakiness_rate > 50 ? "bg-red-500/5" : ""
                }`}
              >
                <td className="py-3 pr-4 text-[#f1f5f9] max-w-sm truncate font-mono text-xs">
                  {test.name}
                </td>
                <td className="py-3 pr-4 text-[#f87171]">
                  {test.failure_count}
                </td>
                <td className="py-3 pr-4 text-[#94a3b8]">{test.total_runs}</td>
                <td className="py-3 pr-4">
                  <span
                    className={`font-medium ${
                      test.flakiness_rate > 50
                        ? "text-[#f87171]"
                        : test.flakiness_rate > 30
                        ? "text-[#facc15]"
                        : "text-[#94a3b8]"
                    }`}
                  >
                    {test.flakiness_rate}%
                  </span>
                </td>
                <td className="py-3 text-[#94a3b8] text-xs">
                  {test.last_seen
                    ? new Date(test.last_seen).toLocaleDateString()
                    : "—"}
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}
