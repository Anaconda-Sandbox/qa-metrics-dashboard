import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { API_BASE_URL } from "../config";
import InfoTip from "./InfoTip";

const api = axios.create({ baseURL: API_BASE_URL });

const priorityColor: Record<string, string> = {
  Highest: "text-rose-400",
  High: "text-orange-300",
  Medium: "text-indigo-300",
  Low: "text-emerald-300",
  Lowest: "text-slate-400",
};

const stateColor: Record<string, string> = {
  merged: "bg-purple-500/15 text-purple-300 border-purple-500/20",
  closed: "bg-slate-500/15 text-slate-400 border-slate-500/20",
  open: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
};

const reviewStateColor: Record<string, string> = {
  APPROVED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
  CHANGES_REQUESTED: "bg-amber-500/15 text-amber-300 border-amber-500/20",
  COMMENTED: "bg-slate-500/15 text-slate-400 border-slate-500/20",
  DISMISSED: "bg-rose-500/15 text-rose-300 border-rose-500/20",
};

function useMemberList() {
  return useQuery({
    queryKey: ["members", "list"],
    queryFn: async () => {
      const { data } = await api.get("/members/list");
      return data;
    },
    staleTime: Infinity,
  });
}

function useMemberActivity(username: string | null, days: number) {
  return useQuery({
    queryKey: ["members", "activity", username, days],
    queryFn: async () => {
      const { data } = await api.get(`/members/activity/${username}?days=${days}`);
      return data;
    },
    enabled: !!username,
  });
}

export default function IndividualView() {
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const { data: memberList } = useMemberList();
  const { data: activity, isLoading, error } = useMemberActivity(selectedMember, days);

  const members = memberList?.members || [];

  return (
    <div className="space-y-6">
      {/* Member Selector */}
      <div className="flex items-center gap-4 flex-wrap">
        <select
          value={selectedMember || ""}
          onChange={(e) => setSelectedMember(e.target.value || null)}
          className="appearance-none bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg px-4 py-2.5 pr-8 text-sm font-medium text-[var(--text-primary)] cursor-pointer hover:border-[var(--accent-primary)]/50 focus:border-[var(--accent-primary)] focus:outline-none transition-colors min-w-[220px]"
        >
          <option value="">Select a team member...</option>
          {members.map((m: { github: string; name: string }) => (
            <option key={m.github} value={m.github}>
              {m.name} ({m.github})
            </option>
          ))}
        </select>

        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="appearance-none bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg px-4 py-2.5 pr-8 text-sm font-medium text-[var(--text-primary)] cursor-pointer hover:border-[var(--accent-primary)]/50 focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
        >
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={60}>Last 60 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {!selectedMember && (
        <div className="rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]/60 p-12 text-center">
          <p className="text-[var(--text-muted)] text-sm">
            Select a team member to view their individual activity
          </p>
        </div>
      )}

      {isLoading && (
        <div className="space-y-6">
          {/* Loading Header with Spinner */}
          <div className="rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]/60 p-8">
            <div className="flex flex-col items-center justify-center space-y-4">
              {/* Spinner */}
              <div className="relative">
                <div className="w-12 h-12 border-4 border-[var(--border-subtle)] rounded-full"></div>
                <div className="absolute top-0 left-0 w-12 h-12 border-4 border-transparent border-t-[var(--accent-primary)] rounded-full animate-spin"></div>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-[var(--text-primary)]">Loading activity data...</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">Fetching from GitHub & Jira</p>
              </div>
            </div>
          </div>
          {/* Skeleton Stats Cards */}
          <div className="rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]/60 p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-[var(--border-subtle)]/60 rounded w-1/4"></div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="rounded-xl bg-[var(--bg-surface)]/40 border border-[var(--border-emphasis)]/40 p-4">
                    <div className="h-8 bg-[var(--border-emphasis)]/40 rounded w-1/2 mx-auto mb-2"></div>
                    <div className="h-3 bg-[var(--border-emphasis)]/30 rounded w-3/4 mx-auto"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Skeleton Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, colIdx) => (
              <div key={colIdx} className="rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]/60 p-6">
                <div className="animate-pulse space-y-3">
                  <div className="flex justify-between items-center mb-4">
                    <div className="h-5 bg-[var(--border-subtle)]/60 rounded w-1/3"></div>
                    <div className="h-5 bg-[var(--border-subtle)]/40 rounded-full w-16"></div>
                  </div>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-lg bg-[var(--bg-surface)]/30 border border-[var(--border-emphasis)]/30 p-3">
                      <div className="h-3 bg-[var(--border-emphasis)]/40 rounded w-2/3 mb-2"></div>
                      <div className="h-4 bg-[var(--border-emphasis)]/30 rounded w-full mb-2"></div>
                      <div className="h-2 bg-[var(--border-emphasis)]/20 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-[var(--bg-elevated)] border border-rose-500/20 p-6">
          <p className="text-sm text-rose-400">Failed to load activity data</p>
        </div>
      )}

      {activity && (
        <div className="space-y-6">
          {/* Stats Summary */}
          <div className="rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]/60 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-[var(--text-primary)]">
                  {activity.stats?.jira_name || activity.username}
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  @{activity.username} &middot; Last {days} days
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="rounded-xl bg-[var(--bg-surface)]/40 border border-[var(--border-emphasis)]/40 p-4 text-center">
                <p className="text-2xl font-bold text-indigo-400">{activity.stats?.prs_opened ?? 0}</p>
                <p className="text-[11px] text-[var(--text-muted)] mt-1 inline-flex items-center justify-center gap-1.5">
                  PRs Opened
                  <InfoTip>Pull requests this person opened in the selected window. Excludes bot PRs.</InfoTip>
                </p>
              </div>
              <div className="rounded-xl bg-[var(--bg-surface)]/40 border border-[var(--border-emphasis)]/40 p-4 text-center">
                <p className="text-2xl font-bold text-emerald-400">{activity.stats?.prs_merged ?? 0}</p>
                <p className="text-[11px] text-[var(--text-muted)] mt-1 inline-flex items-center justify-center gap-1.5">
                  PRs Merged
                  <InfoTip>Subset of PRs Opened that were eventually merged.</InfoTip>
                </p>
              </div>
              <div className="rounded-xl bg-[var(--bg-surface)]/40 border border-[var(--border-emphasis)]/40 p-4 text-center">
                <p className="text-2xl font-bold text-cyan-400">{activity.stats?.prs_reviewed ?? 0}</p>
                <p className="text-[11px] text-[var(--text-muted)] mt-1 inline-flex items-center justify-center gap-1.5">
                  PRs Reviewed
                  <InfoTip>Distinct PRs (from anyone) where this person submitted at least one review action.</InfoTip>
                </p>
              </div>
              <div className="rounded-xl bg-[var(--bg-surface)]/40 border border-[var(--border-emphasis)]/40 p-4 text-center">
                <p className="text-2xl font-bold text-amber-400">{activity.jira_total ?? 0}</p>
                <p className="text-[11px] text-[var(--text-muted)] mt-1 inline-flex items-center justify-center gap-1.5">
                  Jira Tickets Active
                  <InfoTip>Open Jira tickets currently assigned to this person across all projects.</InfoTip>
                </p>
              </div>
              <div className="rounded-xl bg-[var(--bg-surface)]/40 border border-[var(--border-emphasis)]/40 p-4 text-center">
                <div className="flex flex-wrap justify-center gap-1">
                  {Object.entries(activity.stats?.jira_by_type || {}).map(([type, count]) => (
                    <span key={type} className="text-[10px] bg-[var(--border-emphasis)]/50 px-1.5 py-0.5 rounded text-[var(--text-tertiary)]">
                      {type}: {count as number}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1 inline-flex items-center justify-center gap-1.5">
                  Jira by Type
                  <InfoTip>Open tickets broken down by issue type (Bug / Story / Task / etc.).</InfoTip>
                </p>
              </div>
            </div>
          </div>

          {/* Three columns: Jira + GitHub PRs + PR Reviews */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Jira Activity */}
            <div className="rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]/60 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-[var(--text-primary)]">
                  Jira Activity
                </h3>
                <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-surface)] px-2.5 py-1 rounded-full">
                  {activity.jira_total} tickets
                </span>
              </div>
              {activity.jira_items?.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No Jira activity in this period</p>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {activity.jira_items?.map((item: {
                    key: string; summary: string; status: string;
                    issue_type: string; priority: string; updated: string; project: string;
                  }) => (
                    <div
                      key={item.key}
                      className="rounded-lg bg-[var(--bg-surface)]/30 border border-[var(--border-emphasis)]/30 p-3 hover:bg-[var(--bg-surface)]/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <a
                              href={`https://anaconda.atlassian.net/browse/${item.key}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[var(--accent-primary)] hover:text-[var(--accent-primary)] font-mono text-xs transition-colors flex-shrink-0"
                            >
                              {item.key}
                            </a>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--border-emphasis)]/50 text-[var(--text-tertiary)]">
                              {item.issue_type}
                            </span>
                            <span className={`text-[10px] ${priorityColor[item.priority] || "text-slate-400"}`}>
                              {item.priority}
                            </span>
                          </div>
                          <p className="text-sm text-[var(--text-primary)] truncate">
                            {item.summary}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--border-emphasis)]/50 text-[var(--text-tertiary)]">
                              {item.status}
                            </span>
                            <span className="text-[10px] text-[var(--text-muted)]">
                              {item.project}
                            </span>
                            <span className="text-[10px] text-[var(--text-muted)]">
                              {item.updated ? new Date(item.updated).toLocaleDateString() : ""}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* GitHub Activity */}
            <div className="rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]/60 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-[var(--text-primary)]">
                  GitHub PRs
                </h3>
                <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-surface)] px-2.5 py-1 rounded-full">
                  {activity.github_total} PRs
                </span>
              </div>
              {activity.github_prs?.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No GitHub PRs in this period</p>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {activity.github_prs?.map((pr: {
                    title: string; number: number; state: string;
                    repo: string; created_at: string; merged_at: string | null; url: string;
                  }) => (
                    <div
                      key={`${pr.repo}-${pr.number}`}
                      className="rounded-lg bg-[var(--bg-surface)]/30 border border-[var(--border-emphasis)]/30 p-3 hover:bg-[var(--bg-surface)]/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <a
                              href={pr.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[var(--accent-primary)] hover:text-[var(--accent-primary)] font-mono text-xs transition-colors flex-shrink-0"
                            >
                              #{pr.number}
                            </a>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${stateColor[pr.state] || stateColor.closed}`}>
                              {pr.state}
                            </span>
                            <span className="text-[10px] text-[var(--text-muted)]">
                              {pr.repo}
                            </span>
                          </div>
                          <p className="text-sm text-[var(--text-primary)] truncate">
                            {pr.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-[var(--text-muted)]">
                              Created: {new Date(pr.created_at).toLocaleDateString()}
                            </span>
                            {pr.merged_at && (
                              <span className="text-[10px] text-purple-400">
                                Merged: {new Date(pr.merged_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* PR Reviews */}
            <div className="rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]/60 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-[var(--text-primary)]">
                  PR Reviews
                </h3>
                <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-surface)] px-2.5 py-1 rounded-full">
                  {activity.pr_reviews_total ?? 0} reviews
                </span>
              </div>
              {activity.pr_reviews?.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No PR reviews in this period</p>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {activity.pr_reviews?.map((review: {
                    pr_title: string; pr_number: number; repo: string;
                    state: string; submitted_at: string; pr_author: string; url: string;
                  }, idx: number) => (
                    <div
                      key={`${review.repo}-${review.pr_number}-${idx}`}
                      className="rounded-lg bg-[var(--bg-surface)]/30 border border-[var(--border-emphasis)]/30 p-3 hover:bg-[var(--bg-surface)]/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <a
                              href={review.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[var(--accent-primary)] hover:text-[var(--accent-primary)] font-mono text-xs transition-colors flex-shrink-0"
                            >
                              #{review.pr_number}
                            </a>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${reviewStateColor[review.state] || reviewStateColor.COMMENTED}`}>
                              {review.state}
                            </span>
                            <span className="text-[10px] text-[var(--text-muted)]">
                              {review.repo}
                            </span>
                          </div>
                          <p className="text-sm text-[var(--text-primary)] truncate">
                            {review.pr_title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-[var(--text-muted)]">
                              Author: {review.pr_author}
                            </span>
                            <span className="text-[10px] text-cyan-400">
                              Reviewed: {new Date(review.submitted_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
