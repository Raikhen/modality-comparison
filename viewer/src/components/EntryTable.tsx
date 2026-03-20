"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { EntrySummary } from "@/lib/types";
import { DomainBadge } from "./DomainBadge";
import { FilterBar } from "./FilterBar";

type SortKey = "entry_id" | "risk_domain" | "prompt_preview";
type SortDir = "asc" | "desc";

function SortIndicator({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <svg
      className="inline-block ml-1 w-2.5 h-3 align-middle"
      viewBox="0 0 10 14"
      fill="currentColor"
      aria-hidden="true"
      style={{ color: active ? "var(--color-ink-secondary)" : "var(--color-ink-muted)" }}
    >
      <path
        d="M5 1L8.5 5.5H1.5Z"
        opacity={!active || dir === "asc" ? 1 : 0.2}
      />
      <path
        d="M5 13L1.5 8.5H8.5Z"
        opacity={!active || dir === "desc" ? 1 : 0.2}
      />
    </svg>
  );
}

export function EntryTable({
  entries,
  domains,
}: {
  entries: EntrySummary[];
  domains: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = (searchParams.get("q") ?? "").toLowerCase();
  const domain = searchParams.get("domain") ?? "";
  const benchmarkOnly = searchParams.get("benchmark") === "1";
  const variantsOnly = searchParams.get("variants") === "1";

  const hasBenchmark = entries.some(
    (e) => e.benchmark_sources && e.benchmark_sources.length > 0
  );
  const hasAnyVariants = entries.some((e) => e.has_variants);

  const [sortKey, setSortKey] = useState<SortKey>("entry_id");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const navigateToEntry = (entryId: number) => {
    const qs = searchParams.toString();
    router.push(`/entry/${entryId}${qs ? `?${qs}` : ""}`);
  };

  const filtered = entries.filter((e) => {
    if (domain && e.risk_domain !== domain) return false;
    if (variantsOnly && !e.has_variants) return false;
    if (benchmarkOnly && !(e.benchmark_sources && e.benchmark_sources.length > 0))
      return false;
    if (
      q &&
      !e.prompt_preview.toLowerCase().includes(q) &&
      !String(e.entry_id).includes(q)
    )
      return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let cmp: number;
    if (sortKey === "entry_id") {
      cmp = a.entry_id - b.entry_id;
    } else {
      cmp = a[sortKey].localeCompare(b[sortKey]);
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  const columns: { key: SortKey; label: string; width?: string }[] = [
    { key: "entry_id", label: "ID", width: "56px" },
    { key: "risk_domain", label: "Domain", width: "180px" },
    { key: "prompt_preview", label: "Prompt" },
  ];

  const ariaSort = (key: SortKey): "ascending" | "descending" | "none" => {
    if (sortKey !== key) return "none";
    return sortDir === "asc" ? "ascending" : "descending";
  };

  return (
    <div>
      <FilterBar domains={domains} hasBenchmark={hasBenchmark} hasAnyVariants={hasAnyVariants} />
      <div
        className="font-mono text-[11px] uppercase tracking-wider mb-2"
        style={{ color: "var(--color-ink-muted)" }}
      >
        {sorted.length} of {entries.length} entries
      </div>
      <div
        className="rounded-sm overflow-hidden"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-rule)",
        }}
      >
        <table className="w-full text-xs" role="grid">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-rule-emphasis)" }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleSort(col.key);
                    }
                  }}
                  tabIndex={0}
                  aria-sort={ariaSort(col.key)}
                  className="px-3 py-2 text-left font-mono font-medium uppercase tracking-wider cursor-pointer select-none"
                  style={{
                    color: "var(--color-ink-tertiary)",
                    fontSize: "11px",
                    width: col.width,
                    background: "var(--color-surface-raised)",
                  }}
                >
                  {col.label}
                  <SortIndicator
                    active={sortKey === col.key}
                    dir={sortDir}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-3 py-8 text-center font-mono text-xs"
                  style={{ color: "var(--color-ink-muted)" }}
                >
                  No entries match your search.
                </td>
              </tr>
            ) : (
              sorted.map((entry, i) => (
                <tr
                  key={entry.entry_id}
                  role="link"
                  tabIndex={0}
                  aria-label={`Entry ${entry.entry_id}, ${entry.risk_domain}`}
                  onClick={() => navigateToEntry(entry.entry_id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigateToEntry(entry.entry_id);
                    }
                  }}
                  className="cursor-pointer transition-colors duration-75 hover-amber"
                  style={
                    i < sorted.length - 1
                      ? { borderBottom: "1px solid var(--color-rule)" }
                      : undefined
                  }
                >
                  <td
                    className="px-3 py-2 font-mono font-medium tabular-nums"
                    style={{ color: entry.has_variants ? "var(--color-ink-secondary)" : "var(--color-ink-muted)" }}
                  >
                    {entry.entry_id}
                    {entry.benchmark_sources && entry.benchmark_sources.length > 0 && (
                      <span
                        className="ml-1.5 font-mono text-[9px] uppercase tracking-wider px-1 py-px rounded-sm align-middle"
                        style={{
                          color: "var(--color-amber)",
                          background: "var(--color-amber-surface)",
                          border: "1px solid var(--color-amber-rule)",
                        }}
                        title={`Benchmark: ${entry.benchmark_sources.join(", ")}`}
                      >
                        BM
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <DomainBadge domain={entry.risk_domain} />
                  </td>
                  <td
                    className="px-3 py-2 truncate max-w-lg"
                    style={{ color: "var(--color-ink-secondary)" }}
                  >
                    {entry.prompt_preview}
                    {entry.prompt_preview.length >= 150 ? "..." : ""}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
