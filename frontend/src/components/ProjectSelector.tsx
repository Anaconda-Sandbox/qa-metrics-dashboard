import { useConfig } from "../hooks/useMetrics";

interface ProjectSelectorProps {
  project: string;
  onProjectChange: (project: string) => void;
}

export default function ProjectSelector({ project, onProjectChange }: ProjectSelectorProps) {
  const { data: config } = useConfig();

  const projects = config?.projects || [];

  return (
    <div className="relative">
      <select
        value={project}
        onChange={(e) => onProjectChange(e.target.value)}
        className="appearance-none bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg pl-3 pr-8 py-1.5 text-xs font-medium text-[var(--text-secondary)] cursor-pointer hover:border-[var(--accent-primary)]/50 focus:border-[var(--accent-primary)] focus:outline-none transition-colors bg-no-repeat"
        style={{ backgroundImage: "none" }}
      >
        <option value="ALL">All Projects</option>
        {projects.map((p: { key: string; name: string }) => (
          <option key={p.key} value={p.key}>
            {p.key} - {p.name}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}
