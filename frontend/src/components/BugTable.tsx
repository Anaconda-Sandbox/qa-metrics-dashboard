import { useState, useMemo } from "react";
import { useOpenBugs } from "../hooks/useMetrics";

const priorityColor: Record<string, string> = {
  Highest: "bg-rose-500/15 text-rose-400 border-rose-500/20",
  High: "bg-orange-500/15 text-orange-300 border-orange-500/20",
  Medium: "bg-indigo-500/15 text-indigo-300 border-indigo-500/20",
  Low: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
  Lowest: "bg-slate-500/15 text-slate-400 border-slate-500/20",
};

interface Props {
  project: string | null;
  quarter?: string;
}

interface Bug {
  key: string;
  summary: string;
  reporter: string;
  priority: string;
  status: string;
  created: string;
  project: string;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function BugTable({ project, quarter }: Props) {
  const { data, isLoading, error } = useOpenBugs(2000, null, project, quarter);

  const [priorityFilter, setPriorityFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [projectFilter, setProjectFilter] = useState<string>("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const bugs = (data?.bugs || []) as Bug[];

  const { priorities, statuses, projects } = useMemo(() => {
    const prioritySet = new Set<string>();
    const statusSet = new Set<string>();
    const projectSet = new Set<string>();

    bugs.forEach((bug) => {
      if (bug.priority) prioritySet.add(bug.priority);
      if (bug.status) statusSet.add(bug.status);
      if (bug.project) projectSet.add(bug.project);
    });

    return {
      priorities: Array.from(prioritySet).sort(),
      statuses: Array.from(statusSet).sort(),
      projects: Array.from(projectSet).sort(),
    };
  }, [bugs]);

  const filteredBugs = useMemo(() => {
    return bugs.filter((bug) => {
      if (priorityFilter !== "All" && bug.priority !== priorityFilter) return false;
      if (statusFilter !== "All" && bug.status !== statusFilter) return false;
      if (projectFilter !== "All" && bug.project !== projectFilter) return false;
      return true;
    });
  }, [bugs, priorityFilter, statusFilter, projectFilter]);

  // Reset to page 1 when filters change
  useMemo(() => {
    setCurrentPage(1);
  }, [priorityFilter, statusFilter, projectFilter]);

  const totalPages = Math.ceil(filteredBugs.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedBugs = filteredBugs.slice(startIndex, endIndex);

  const activeFilterCount = [priorityFilter, statusFilter, projectFilter].filter(f => f !== "All").length;

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

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
          {filteredBugs.length} total
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4 pb-4 border-b border-[#1e2a3a]/40">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-[#64748b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <span className="text-xs text-[#64748b]">Filters:</span>
        </div>

        {/* Priority Filter */}
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="bg-[#1e293b] border border-[#334155]/40 text-[#e2e8f0] text-xs rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none cursor-pointer"
        >
          <option value="All">All Priorities</option>
          {priorities.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#1e293b] border border-[#334155]/40 text-[#e2e8f0] text-xs rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none cursor-pointer"
        >
          <option value="All">All Statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Project Filter */}
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="bg-[#1e293b] border border-[#334155]/40 text-[#e2e8f0] text-xs rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none cursor-pointer"
        >
          <option value="All">All Projects</option>
          {projects.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        {/* Clear Filters */}
        {activeFilterCount > 0 && (
          <button
            onClick={() => {
              setPriorityFilter("All");
              setStatusFilter("All");
              setProjectFilter("All");
            }}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear ({activeFilterCount})
          </button>
        )}
      </div>

      {filteredBugs.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-[#64748b]">No bugs match the selected filters</p>
        </div>
      ) : (
        <>
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
              {paginatedBugs.map((bug) => (
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
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between mt-4 pt-4 border-t border-[#1e2a3a]/40 gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#64748b]">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-[#1e293b] border border-[#334155]/40 text-[#e2e8f0] text-xs rounded-lg px-2 py-1 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none cursor-pointer"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-xs text-[#64748b] mr-2">
                {startIndex + 1}-{Math.min(endIndex, filteredBugs.length)} of {filteredBugs.length}
              </span>

              {/* First Page */}
              <button
                onClick={() => goToPage(1)}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg hover:bg-[#1e293b] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="First page"
              >
                <svg className="w-4 h-4 text-[#94a3b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>

              {/* Previous Page */}
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg hover:bg-[#1e293b] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Previous page"
              >
                <svg className="w-4 h-4 text-[#94a3b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* Page Numbers */}
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => goToPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                        currentPage === pageNum
                          ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                          : "text-[#94a3b8] hover:bg-[#1e293b]"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              {/* Next Page */}
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg hover:bg-[#1e293b] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Next page"
              >
                <svg className="w-4 h-4 text-[#94a3b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Last Page */}
              <button
                onClick={() => goToPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg hover:bg-[#1e293b] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Last page"
              >
                <svg className="w-4 h-4 text-[#94a3b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
