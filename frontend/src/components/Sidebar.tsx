type View = "dashboard" | "team" | "individual" | "dx" | "links";

interface SidebarProps {
  view: View;
  onChange: (view: View) => void;
}

interface NavItem {
  key: View;
  label: string;
  audience: string;
  icon: React.ReactNode;
}

const NAV_GROUPS: { heading: string; items: NavItem[] }[] = [
  {
    heading: "Leadership",
    items: [
      {
        key: "dashboard",
        label: "Dashboard",
        audience: "Executive summary",
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
        ),
      },
    ],
  },
  {
    heading: "QA Team",
    items: [
      {
        key: "team",
        label: "Team",
        audience: "Per-member breakdowns",
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        ),
      },
      {
        key: "dx",
        label: "DX Metrics",
        audience: "Developer experience",
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ),
      },
      {
        key: "individual",
        label: "Individual",
        audience: "Single-member view",
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        ),
      },
    ],
  },
  {
    heading: "Resources",
    items: [
      {
        key: "links",
        label: "QA Links",
        audience: "Central navigation hub",
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        ),
      },
    ],
  },
];

export default function Sidebar({ view, onChange }: SidebarProps) {
  return (
    <aside className="hidden md:flex flex-col w-64 shrink-0 border-r border-[var(--border-subtle)] bg-[var(--bg-elevated)]/40 backdrop-blur-sm">
      {/* Brand */}
      <div className="px-6 py-5 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-bold text-[var(--text-primary)] tracking-tight">QA Metrics</h1>
            <p className="text-[10px] text-[var(--text-muted)] font-medium tracking-widest uppercase">
              Engineering Analytics
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 space-y-6 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.heading}>
            <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
              {group.heading}
            </div>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = view === item.key;
                return (
                  <li key={item.key}>
                    <button
                      onClick={() => onChange(item.key)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
                        active
                          ? "bg-[var(--accent-primary)] text-white shadow-md shadow-[var(--accent-primary)]/20"
                          : "text-[var(--text-tertiary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      <span className={active ? "text-white" : "text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]"}>
                        {item.icon}
                      </span>
                      <div className="flex-1 text-left">
                        <div className="leading-tight">{item.label}</div>
                        <div className={`text-[10px] mt-0.5 ${active ? "text-white/70" : "text-[var(--text-muted)]"}`}>
                          {item.audience}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Data sources footer */}
      <div className="px-6 py-4 border-t border-[var(--border-subtle)]">
        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest mb-2">Data Sources</p>
        <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-[11px] text-[var(--text-muted)]">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--info-base)]" />
            Jira
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--success-base)]" />
            GitHub
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--warning-base)]" />
            ReportPortal
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)]" />
            DX
          </span>
        </div>
      </div>
    </aside>
  );
}
