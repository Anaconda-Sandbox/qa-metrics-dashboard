import { useMemo, useState } from "react";
import { QA_LINK_GROUPS, SOURCE_META, QALink } from "../data/qaLinks";

function ExternalIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5h5m0 0v5m0-5L10 14M5 5h4M5 19h14a0 0 0 000 0V9" />
    </svg>
  );
}

function LinkCard({ link }: { link: QALink }) {
  const meta = SOURCE_META[link.source];
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-4 transition-all duration-150 hover:border-[var(--accent-primary)]/50 hover:shadow-lg flex flex-col gap-2"
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
          style={{ backgroundColor: `color-mix(in srgb, ${meta.color} 15%, transparent)`, color: meta.color }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
          {meta.label}
        </span>
        <span className="text-[var(--text-muted)] group-hover:text-[var(--accent-primary)] transition-colors">
          <ExternalIcon />
        </span>
      </div>
      <div className="flex-1">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] leading-snug group-hover:text-[var(--accent-primary)] transition-colors">
          {link.label}
        </h3>
        {link.description && (
          <p className="mt-1 text-xs text-[var(--text-muted)]">{link.description}</p>
        )}
      </div>
    </a>
  );
}

export default function QALinksView() {
  const [query, setQuery] = useState("");

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return QA_LINK_GROUPS;
    return QA_LINK_GROUPS
      .map((g) => ({
        ...g,
        links: g.links.filter(
          (l) =>
            l.label.toLowerCase().includes(q) ||
            (l.description?.toLowerCase().includes(q) ?? false) ||
            g.category.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.links.length > 0);
  }, [query]);

  const totalLinks = QA_LINK_GROUPS.reduce((sum, g) => sum + g.links.length, 0);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">QA Links</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Central navigation hub for QA resources, dashboards, and documentation
            <span className="mx-2 text-[var(--border-subtle)]">·</span>
            <span>{totalLinks} links</span>
          </p>
        </div>

        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search links..."
            className="pl-9 pr-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors w-64"
          />
        </div>
      </div>

      {/* Groups */}
      {filteredGroups.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-muted)]">
          No links match "{query}".
        </div>
      ) : (
        filteredGroups.map((group) => (
          <section key={group.category}>
            <div className="mb-4">
              <h2 className="text-base font-semibold text-[var(--text-primary)] tracking-tight">
                {group.category}
                <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">
                  ({group.links.length})
                </span>
              </h2>
              {group.blurb && (
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{group.blurb}</p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {group.links.map((link) => (
                <LinkCard key={link.url} link={link} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
