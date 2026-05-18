import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { API_BASE_URL } from "../config";

const api = axios.create({ baseURL: API_BASE_URL });

function filterParams(squad: string | null, project: string | null, quarter?: string | null): string {
  const params: string[] = [];
  if (squad && squad !== "ALL") params.push(`squad=${squad}`);
  if (project && project !== "ALL") params.push(`project=${project}`);
  if (quarter) params.push(`quarter=${quarter}`);
  return params.length > 0 ? `?${params.join("&")}` : "";
}

export function useConfig() {
  return useQuery({
    queryKey: ["config"],
    queryFn: async () => {
      const { data } = await api.get("/config");
      return data;
    },
    staleTime: Infinity,
  });
}

export function useDefectDensity(squad: string | null = null, project: string | null = null, quarter: string | null = null) {
  return useQuery({
    queryKey: ["jira", "defect-density", squad, project, quarter],
    queryFn: async () => {
      const { data } = await api.get(`/jira/defect-density${filterParams(squad, project, quarter)}`);
      return data;
    },
  });
}

export function useOpenBugs(limit = 20, squad: string | null = null, project: string | null = null, quarter: string | null = null) {
  return useQuery({
    queryKey: ["jira", "open-bugs", limit, squad, project, quarter],
    queryFn: async () => {
      let url = `/jira/open-bugs?limit=${limit}`;
      if (squad && squad !== "ALL") url += `&squad=${squad}`;
      if (project && project !== "ALL") url += `&project=${project}`;
      if (quarter) url += `&quarter=${quarter}`;
      const { data } = await api.get(url);
      return data;
    },
  });
}

export function useAutomationCoverage(squad: string | null = null, project: string | null = null, quarter: string | null = null) {
  return useQuery({
    queryKey: ["jira", "automation-coverage", squad, project, quarter],
    queryFn: async () => {
      const { data } = await api.get(`/jira/automation-coverage${filterParams(squad, project, quarter)}`);
      return data;
    },
  });
}

export function useReportPortalStats() {
  return useQuery({
    queryKey: ["reportportal", "stats"],
    queryFn: async () => {
      const { data } = await api.get("/reportportal/stats");
      return data;
    },
  });
}

export function useLaunches(limit = 10) {
  return useQuery({
    queryKey: ["reportportal", "launches", limit],
    queryFn: async () => {
      const { data } = await api.get(`/reportportal/launches?limit=${limit}`);
      return data;
    },
  });
}

export function useFlakyTests(limit = 20) {
  return useQuery({
    queryKey: ["reportportal", "flaky-tests", limit],
    queryFn: async () => {
      const { data } = await api.get(`/reportportal/flaky-tests?limit=${limit}`);
      return data;
    },
  });
}

export function usePRTrends(squad: string | null = null, project: string | null = null, quarter: string | null = null) {
  return useQuery({
    queryKey: ["github", "pr-trends", squad, project, quarter],
    queryFn: async () => {
      const { data } = await api.get(`/github/pr-trends${filterParams(squad, project, quarter)}`);
      return data;
    },
  });
}

export function usePRStats(squad: string | null = null, project: string | null = null, quarter: string | null = null) {
  return useQuery({
    queryKey: ["github", "pr-stats", squad, project, quarter],
    queryFn: async () => {
      const { data } = await api.get(`/github/pr-stats${filterParams(squad, project, quarter)}`);
      return data;
    },
  });
}

export function useTeamContributions(squad: string | null = null, project: string | null = null, quarter: string | null = null) {
  return useQuery({
    queryKey: ["github", "team-contributions", squad, project, quarter],
    queryFn: async () => {
      let url = `/github/team-contributions`;
      const params: string[] = [];
      if (squad && squad !== "ALL") params.push(`squad=${squad}`);
      if (project && project !== "ALL") params.push(`project=${project}`);
      if (quarter) params.push(`quarter=${quarter}`);
      if (params.length > 0) url += `?${params.join("&")}`;
      const { data } = await api.get(url);
      return data;
    },
  });
}
