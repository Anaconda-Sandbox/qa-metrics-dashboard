import { useConfig } from "../hooks/useMetrics";

interface ProjectSelectorProps {
  squad: string;
  onSquadChange: (squad: string) => void;
}

export default function ProjectSelector({ squad, onSquadChange }: ProjectSelectorProps) {
  const { data: config } = useConfig();

  const squads = config?.squads || [];

  return (
    <div className="flex items-center gap-2">
      <select
        value={squad}
        onChange={(e) => onSquadChange(e.target.value)}
        className="appearance-none bg-[#0f1419] border border-[#1e2a3a] rounded-lg px-3 py-1.5 pr-8 text-xs font-medium text-[#e2e8f0] cursor-pointer hover:border-[#6366f1]/50 focus:border-[#6366f1] focus:outline-none transition-colors"
      >
        <option value="ALL">All Squads</option>
        {squads.map((s: { key: string; name: string }) => (
          <option key={s.key} value={s.key}>
            {s.name}
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
