import { useConfig } from "../hooks/useMetrics";

interface ProjectSelectorProps {
  project: string;
  onProjectChange: (project: string) => void;
}

export default function ProjectSelector({ project, onProjectChange }: ProjectSelectorProps) {
  const { data: config } = useConfig();

  const projects = config?.projects || [];

  return (
    <div className="flex items-center gap-2">
      <select
        value={project}
        onChange={(e) => onProjectChange(e.target.value)}
        className="appearance-none bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 pr-8 text-xs font-medium text-[var(--text-secondary)] cursor-pointer hover:border-[var(--accent-primary)]/50 focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
      >
        <option value="ALL">All Projects</option>
        {projects.map((p: { key: string; name: string }) => (
          <option key={p.key} value={p.key}>
            {p.key} - {p.name}
          </option>
        ))}
      </select>
      <div className="relative -ml-6 pointer-events-none">
        <svg className="w-3.5 h-3.5 text-[#64748b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}
