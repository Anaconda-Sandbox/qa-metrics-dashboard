import { useState } from "react";
import ViewToggle from "./components/ViewToggle";
import ProjectSelector from "./components/ProjectSelector";
import IndividualView from "./components/IndividualView";
import UnifiedDashboard from "./components/UnifiedDashboard";

export default function App() {
  const [view, setView] = useState<"dashboard" | "individual">("dashboard");
  const [squad, setSquad] = useState("ALL");

  const sq = squad === "ALL" ? null : squad;

  return (
    <div className="min-h-screen bg-[#080b10] text-[#e2e8f0]">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#080b10]/80 border-b border-[#1e2a3a]/40">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-lg font-bold text-[#e2e8f0] tracking-tight">
                  QA Metrics Dashboard
                </h1>
                <p className="text-[11px] text-[#64748b] font-medium tracking-wide uppercase">
                  Anaconda QA Automation
                </p>
              </div>
              <div className="h-8 w-px bg-[#1e2a3a]/60 hidden sm:block" />
              <ProjectSelector squad={squad} onSquadChange={setSquad} />
            </div>
            <ViewToggle view={view} onToggle={setView} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-6 py-8">
        {view === "dashboard" ? (
          <UnifiedDashboard squad={sq} />
        ) : (
          <IndividualView />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1e2a3a]/40 mt-12">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <p className="text-[11px] text-[#475569] text-center">
            Data refreshes every 10 minutes &middot; Powered by GitHub, Jira, and ReportPortal APIs
          </p>
        </div>
      </footer>
    </div>
  );
}
