import { useOpenBugs } from "../hooks/useMetrics";

const priorityColor: Record<string, string> = {
  Highest: "bg-rose-500/15 text-rose-400 border-rose-500/20",
  High: "bg-orange-500/15 text-orange-300 border-orange-500/20",
  Medium: "bg-indigo-500/15 text-indigo-300 border-indigo-500/20",
  Low: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
  Lowest: "bg-slate-500/15 text-slate-400 border-slate-500/20",
};

interface Props {
  squad: string | null;
}

export default function BugTable({ squad }: Props) {
  const { data, isLoading, error } = useOpenBugs(20, squad);

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-[#0f1419] border border-[#1e2a3a]/60 p-6">
        <div className="flex flex-col items-center justify-center py-4 space-y-3">
          <div className="relative">
            <div className="w-8 h-8 border-2 border-[#1e2a3a] rounded-full"></div>
            <div className="absolute top-0 left-0 w-8 h-8 border-2 border-transparent border-t-[#f43f5e] rounded-full animate-spin"></div>
          </div>
          <p className="text-xs text-[#64748b]">Loading bugs...</p>
        </div>
        <div className="animate-pulse space-y-3 mt-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-[#1e2a3a]/40 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl bg-[#0f1419] border border-[#1e2a3a]/60 p-6">
        <h3 className="text-sm font-medium text-[#64748b] mb-2">Open Bugs</h3>
        <p className="text-sm text-[#f87171]">Failed to load: Jira</p>
      </div>
    );
  }

  const bugs = data.bugs || [];
  if (bugs.length === 0) {
    return (
      <div className="rounded-2xl bg-[#0f1419] border border-[#1e2a3a]/60 p-6">
        <h3 className="text-sm font-medium text-[#64748b] mb-2">Open Bugs</h3>
        <p className="text-sm text-[#64748b]">No open bugs</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-[#0f1419] border border-[#1e2a3a]/60 p-6 overflow-x-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-[#e2e8f0]">
          Open Bugs
        </h3>
        <span className="text-xs text-[#64748b] bg-[#1e293b] px-2.5 py-1 rounded-full">
          {data.total} total
        </span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[#64748b] border-b border-[#1e2a3a]/60">
            <th className="pb-3 pr-4 font-medium text-xs uppercase tracking-wider">Key</th>
            <th className="pb-3 pr-4 font-medium text-xs uppercase tracking-wider">Summary</th>
            <th className="pb-3 pr-4 font-medium text-xs uppercase tracking-wider">Reporter</th>
            <th className="pb-3 pr-4 font-medium text-xs uppercase tracking-wider">Priority</th>
            <th className="pb-3 pr-4 font-medium text-xs uppercase tracking-wider">Status</th>
            <th className="pb-3 font-medium text-xs uppercase tracking-wider">Created</th>
          </tr>
        </thead>
        <tbody>
          {bugs.map(
            (bug: {
              key: string;
              summary: string;
              reporter: string;
              priority: string;
              status: string;
              created: string;
            }) => (
              <tr
                key={bug.key}
                className="border-b border-[#1e2a3a]/30 hover:bg-[#1e293b]/30 transition-colors"
              >
                <td className="py-3 pr-4">
                  <a
                    href={`https://anaconda.atlassian.net/browse/${bug.key}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#6366f1] hover:text-[#818cf8] font-mono text-xs transition-colors"
                  >
                    {bug.key}
                  </a>
                </td>
                <td className="py-3 pr-4 text-[#e2e8f0] max-w-sm truncate">
                  {bug.summary}
                </td>
                <td className="py-3 pr-4 text-[#94a3b8] text-xs truncate max-w-[120px]">
                  {bug.reporter || "—"}
                </td>
                <td className="py-3 pr-4">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs border ${
                      priorityColor[bug.priority] || priorityColor["Lowest"]
                    }`}
                  >
                    {bug.priority}
                  </span>
                </td>
                <td className="py-3 pr-4">
                  <span className="px-2 py-0.5 rounded-full text-xs bg-[#1e293b] text-[#94a3b8] border border-[#334155]/40">
                    {bug.status}
                  </span>
                </td>
                <td className="py-3 text-[#64748b] text-xs">
                  {bug.created ? new Date(bug.created).toLocaleDateString() : "—"}
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}
