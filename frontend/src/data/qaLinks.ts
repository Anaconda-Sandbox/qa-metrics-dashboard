export type LinkSource =
  | "grafana"
  | "google"
  | "jira"
  | "confluence"
  | "github"
  | "other";

export interface QALink {
  label: string;
  url: string;
  description?: string;
  source: LinkSource;
}

export interface QALinkGroup {
  category: string;
  blurb?: string;
  links: QALink[];
}

function inferSource(url: string): LinkSource {
  if (url.includes("grafana.")) return "grafana";
  if (url.includes("docs.google.com")) return "google";
  if (url.includes("/jira/")) return "jira";
  if (url.includes("/wiki/")) return "confluence";
  if (url.includes("github.com")) return "github";
  if (url.includes("atlassian.net")) return "jira";
  return "other";
}

function link(label: string, url: string, description?: string): QALink {
  return { label, url, description, source: inferSource(url) };
}

export const QA_LINK_GROUPS: QALinkGroup[] = [
  {
    category: "Dashboards & Boards",
    blurb: "Live monitoring, bug boards, and summary dashboards.",
    links: [
      link("QA Grafana Dashboard", "https://grafana.anacondaconnect.com/dashboards/f/fdst9na2lsa9sf/"),
      link("QA Board of Open Bugs", "https://anaconda.atlassian.net/jira/dashboards/10251"),
      link("QA Monthly Task Board", "https://anaconda.atlassian.net/jira/dashboards/10250"),
      link("QA Summary Board", "https://anaconda.atlassian.net/jira/dashboards/10238"),
      link("QA Confluence Board", "https://anaconda.atlassian.net/wiki/spaces/QA/pages/4019945495/QA+Board"),
      link("QA Quarter-3 Bugs 2026 — Timeline", "https://anaconda.atlassian.net/jira/plans/238/scenarios/239/timeline?vid=365"),
    ],
  },
  {
    category: "QA Updates & Tasks",
    blurb: "Weekly and quarterly task tracking.",
    links: [
      link("Confluence Weekly Updates", "https://anaconda.atlassian.net/wiki/spaces/QA/pages/4856250399/Weekly+Updates"),
      link("Jira Weekly Tasks Timeline", "https://anaconda.atlassian.net/jira/plans/73/scenarios/74/timeline?vid=201"),
      link("Jira Quarterly Tasks Timeline", "https://anaconda.atlassian.net/jira/plans/172/scenarios/173/timeline"),
    ],
  },
  {
    category: "QA PI Planning",
    blurb: "Quarterly PI planning sheets.",
    links: [
      link("Q2 — 2026", "https://docs.google.com/spreadsheets/d/1GTIPJqQafUKzlYfhZ7oypCFHYAvgomQ9itROMh0laJU/edit?gid=1902779402#gid=1902779402"),
      link("Q1 — 2026", "https://docs.google.com/spreadsheets/d/1dGwkviDbl5M6vIgF_kZFtCpvTiswG7ZF7MB_g8ppz2Y/edit?gid=875851264#gid=875851264"),
      link("Q4 — 2025", "https://docs.google.com/spreadsheets/d/1XGktfH0i065n8VDUIRGRuwlg-nGP6kIW8F2iaVau7z8/edit?gid=1902779402#gid=1902779402", "PI Planning metrics"),
      link("Q3 — 2025", "https://docs.google.com/spreadsheets/d/1yrA_ZzJRjAvGETszQwEakJ0Y5NQ2m06MasuroeEgsH4/edit?gid=1902779402#gid=1902779402"),
    ],
  },
  {
    category: "Quarterly Reports",
    blurb: "Past quarter Jira report dashboards.",
    links: [
      link("QA Quarter-3 Report — 2025", "https://anaconda.atlassian.net/jira/dashboards/11188"),
      link("QA Quarter-2 Report — 2025", "https://anaconda.atlassian.net/jira/dashboards/10727"),
    ],
  },
  {
    category: "Process & Documentation",
    blurb: "QA processes and testing playbooks.",
    links: [
      link("QA Release Testing Process", "https://anaconda.atlassian.net/wiki/spaces/QA/pages/4019968036/QA+Release+Testing+Process"),
      link("QA Story Testing Process", "https://anaconda.atlassian.net/wiki/spaces/QA/pages/4019968018/QA+Story+Testing+Process"),
    ],
  },
  {
    category: "Metrics & Coverage",
    blurb: "Manual tracking sheets used alongside this dashboard.",
    links: [
      link("Automation Coverage", "https://docs.google.com/spreadsheets/d/1wje9d1Vme_CrGXAeGr0C6DaOJgPmgJok8MDIYJsFQPM/edit?gid=720695583#gid=720695583"),
      link("QA Metrics", "https://docs.google.com/spreadsheets/d/1wje9d1Vme_CrGXAeGr0C6DaOJgPmgJok8MDIYJsFQPM/edit#gid=0"),
    ],
  },
  {
    category: "Learning & Resources",
    blurb: "Tools and exercises for skills growth.",
    links: [
      link("Playwright Challenges", "https://github.com/vasu31dev/playwright-challenges"),
    ],
  },
];

export const SOURCE_META: Record<LinkSource, { label: string; color: string }> = {
  grafana: { label: "Grafana", color: "var(--warning-base)" },
  google: { label: "Google Docs", color: "var(--success-base)" },
  jira: { label: "Jira", color: "var(--info-base)" },
  confluence: { label: "Confluence", color: "var(--accent-primary)" },
  github: { label: "GitHub", color: "var(--text-secondary)" },
  other: { label: "Link", color: "var(--text-muted)" },
};
