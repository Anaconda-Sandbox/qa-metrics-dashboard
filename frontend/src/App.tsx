import { useState } from "react";
import ViewToggle from "./components/ViewToggle";
import ProjectSelector from "./components/ProjectSelector";
import QuarterSelector, { getCurrentQuarter, getQuarterOptions } from "./components/QuarterSelector";
import IndividualView from "./components/IndividualView";
import ProfessionalDashboard from "./components/ProfessionalDashboard";

export default function App() {
  const [view, setView] = useState<"dashboard" | "individual">("dashboard");
  const [project, setProject] = useState("ALL");
  const [quarter, setQuarter] = useState(getCurrentQuarter());
  const [compareQuarter, setCompareQuarter] = useState<string | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  const proj = project === "ALL" ? null : project;
  const quarterOptions = getQuarterOptions();

  const handleCompareToggle = () => {
    if (isComparing) {
      setCompareQuarter(null);
    } else {
      // Default to previous quarter
      const currentIndex = quarterOptions.findIndex(q => q.value === quarter);
      if (currentIndex < quarterOptions.length - 1) {
        setCompareQuarter(quarterOptions[currentIndex + 1].value);
      }
    }
    setIsComparing(!isComparing);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-secondary)]">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-[var(--border-subtle)]">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              {/* Logo & Title */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center shadow-lg">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight text-display">
                    QA Metrics
                  </h1>
                  <p className="text-[10px] text-[var(--text-muted)] font-medium tracking-widest uppercase">
                    Engineering Analytics
                  </p>
                </div>
              </div>

              <div className="h-8 w-px bg-[var(--border-subtle)] hidden md:block" />

              {/* Filters */}
              <div className="flex items-center gap-3">
                <ProjectSelector project={project} onProjectChange={setProject} />

                <div className="flex items-center gap-2">
                  <QuarterSelector quarter={quarter} onQuarterChange={setQuarter} />

                  {/* Compare Toggle */}
                  <button
                    onClick={handleCompareToggle}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                      isComparing
                        ? "bg-[var(--accent-primary)] text-white shadow-lg shadow-[var(--accent-primary)]/25 hover:bg-[var(--accent-primary)]/80"
                        : "bg-[var(--bg-surface)] text-[var(--text-tertiary)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/50 hover:text-[var(--text-secondary)]"
                    }`}
                  >
                    {isComparing ? (
                      <>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Exit Compare
                      </>
                    ) : (
                      "Compare"
                    )}
                  </button>

                  {/* Compare Quarter Selector */}
                  {isComparing && (
                    <div className="flex items-center gap-2 animate-fade-in">
                      <span className="text-xs text-[var(--text-muted)]">vs</span>
                      <select
                        value={compareQuarter || ""}
                        onChange={(e) => setCompareQuarter(e.target.value)}
                        className="appearance-none bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] cursor-pointer hover:border-[var(--accent-primary)]/50 focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
                      >
                        {quarterOptions
                          .filter(q => q.value !== quarter)
                          .map((q) => (
                            <option key={q.value} value={q.value}>
                              {q.label}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Refresh indicator */}
              <div className="hidden md:flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <div className="w-2 h-2 rounded-full bg-[var(--success-base)] animate-pulse" />
                <span>Live data</span>
              </div>

              <ViewToggle view={view} onToggle={setView} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1800px] mx-auto px-6 py-8">
        {view === "dashboard" ? (
          <ProfessionalDashboard
            project={proj}
            quarter={quarter}
            compareQuarter={isComparing ? compareQuarter : null}
            onExitCompare={() => {
              setIsComparing(false);
              setCompareQuarter(null);
            }}
          />
        ) : (
          <IndividualView />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border-subtle)] mt-12">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-[var(--text-muted)]">
              Data refreshes every 10 minutes
            </p>
            <div className="flex items-center gap-4 text-[11px] text-[var(--text-muted)]">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--success-base)]" />
                GitHub
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--info-base)]" />
                Jira
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--warning-base)]" />
                ReportPortal
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
