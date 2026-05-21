import { useState } from "react";
import { ThemeProvider } from "./context/ThemeContext";
import ThemeToggle from "./components/ThemeToggle";
import Sidebar from "./components/Sidebar";
import ProjectSelector from "./components/ProjectSelector";
import QuarterSelector, { getCurrentQuarter, getQuarterOptions } from "./components/QuarterSelector";
import IndividualView from "./components/IndividualView";
import ExecutiveDashboard from "./components/ExecutiveDashboard";
import TeamView from "./components/TeamView";
import DXDashboard from "./components/DXDashboard";
import QALinksView from "./components/QALinksView";

export default function App() {
  const [view, setView] = useState<"dashboard" | "team" | "individual" | "dx" | "links">("dashboard");
  const [project, setProject] = useState("ALL");
  const [quarter, setQuarter] = useState(getCurrentQuarter());
  const [compareQuarter, setCompareQuarter] = useState<string | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  const quarterOptions = getQuarterOptions();
  const showFilters = view !== "links";
  const showProjectSelector = view !== "dx" && view !== "links";
  const showCompareControls = view === "dashboard" || view === "dx";

  const handleCompareToggle = () => {
    if (isComparing) {
      setCompareQuarter(null);
    } else {
      const currentIndex = quarterOptions.findIndex(q => q.value === quarter);
      if (currentIndex < quarterOptions.length - 1) {
        setCompareQuarter(quarterOptions[currentIndex + 1].value);
      }
    }
    setIsComparing(!isComparing);
  };

  return (
    <ThemeProvider>
      <div className="min-h-screen flex bg-[var(--bg-base)] text-[var(--text-secondary)]">
        <Sidebar view={view} onChange={setView} />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="sticky top-0 z-40 glass border-b border-[var(--border-subtle)]">
            <div className="px-6 py-3.5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                {/* Filters */}
                <div className="flex items-center gap-3 flex-wrap">
                  {showProjectSelector && (
                    <ProjectSelector project={project} onProjectChange={setProject} />
                  )}

                  {showFilters && <QuarterSelector quarter={quarter} onQuarterChange={setQuarter} />}

                  {showCompareControls && (
                    <>
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
                    </>
                  )}
                </div>

                {/* Right cluster */}
                <div className="flex items-center gap-4">
                  <div className="hidden md:flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    <div className="w-2 h-2 rounded-full bg-[var(--success-base)] animate-pulse" />
                    <span>Live data</span>
                  </div>
                  <ThemeToggle />
                </div>
              </div>
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1 px-6 py-8">
            <div className="max-w-[1600px] mx-auto">
              {view === "dashboard" ? (
                <ExecutiveDashboard
                  quarter={quarter}
                  compareQuarter={isComparing ? compareQuarter : null}
                  onExitCompare={() => {
                    setIsComparing(false);
                    setCompareQuarter(null);
                  }}
                />
              ) : view === "team" ? (
                <TeamView quarter={quarter} />
              ) : view === "dx" ? (
                <DXDashboard
                  quarter={quarter}
                  compareQuarter={isComparing ? compareQuarter : null}
                />
              ) : view === "links" ? (
                <QALinksView />
              ) : (
                <IndividualView />
              )}
            </div>
          </main>

          {/* Footer */}
          <footer className="border-t border-[var(--border-subtle)] mt-12">
            <div className="px-6 py-3">
              <p className="text-[11px] text-[var(--text-muted)]">
                Data refreshes every 10 minutes
              </p>
            </div>
          </footer>
        </div>
      </div>
    </ThemeProvider>
  );
}
