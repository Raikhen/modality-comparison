"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { EntryVariants, Tone, Modality, VariantPatch, Source } from "@/lib/types";
import { SOURCE_LABELS } from "@/lib/types";
import { DomainBadge } from "@/components/DomainBadge";
import { VariantGrid } from "@/components/VariantGrid";
import { CompareView } from "@/components/CompareView";
import { BenchmarkCompare } from "@/components/BenchmarkCompare";

type View = "grid" | "compare" | "benchmark";

export default function EntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [entry, setEntry] = useState<EntryVariants | null | undefined>(
    undefined
  );
  const [benchmarkSources, setBenchmarkSources] = useState<Source[]>([]);
  const [availableSources, setAvailableSources] = useState<Source[]>([]);
  const [source, setSource] = useState<Source | null>(null);
  const [view, setView] = useState<View>("grid");

  // Load source metadata
  useEffect(() => {
    async function loadMeta() {
      const res = await fetch(`/api/entry/${id}?meta=sources`);
      if (res.ok) {
        const data = await res.json();
        setBenchmarkSources(data.benchmark_sources ?? []);
        setAvailableSources(data.available_sources ?? ["production"]);
        setSource((prev) => prev ?? data.default_source ?? "production");
      }
    }
    loadMeta();
  }, [id]);

  // Load entry data for current source
  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    async function load() {
      const res = await fetch(`/api/entry/${id}?source=${source}`);
      if (cancelled) return;
      if (!res.ok) {
        setEntry(null);
        return;
      }
      setEntry(await res.json());
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id, source]);

  const saveVariant = useCallback(
    async (tone: Tone, modality: Modality, patch: VariantPatch) => {
      const res = await fetch(`/api/entry/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tone, modality, patch }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Save failed");
      }
      const updated: EntryVariants = await res.json();
      setEntry(updated);
    },
    [id]
  );

  const hasBenchmark = benchmarkSources.length >= 2;
  const views: View[] = hasBenchmark
    ? ["grid", "compare", "benchmark"]
    : ["grid", "compare"];

  const viewLabels: Record<View, string> = {
    grid: "Grid",
    compare: "Compare",
    benchmark: "Benchmark",
  };

  if (entry === undefined) {
    return (
      <div
        className="py-8 text-center font-mono text-xs"
        style={{ color: "var(--color-ink-muted)" }}
      >
        Loading entry...
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="py-8 text-center">
        <p
          className="font-mono text-xs mb-4"
          style={{ color: "var(--color-ink-muted)" }}
        >
          Entry {id} not found.
        </p>
        <Link
          href="/"
          className="font-mono text-xs"
          style={{ color: "var(--color-amber)" }}
        >
          Back to entries
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5">
        <Link
          href="/"
          className="font-mono text-[11px] mb-3 inline-block transition-colors duration-75 hover-ink"
          style={{ color: "var(--color-ink-muted)" }}
        >
          <span aria-hidden="true">&larr; </span>All entries
        </Link>
        <div className="flex items-baseline gap-3 mb-2">
          <h1
            className="font-mono text-lg font-semibold tabular-nums"
            style={{ color: "var(--color-ink)" }}
          >
            #{entry.entry_id}
          </h1>
          <DomainBadge domain={entry.risk_domain} />
        </div>
        <p
          className="text-xs leading-relaxed max-w-3xl"
          style={{ color: "var(--color-ink-secondary)" }}
        >
          {entry.original_prompt}
        </p>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="flex gap-2">
          {views.map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="px-3 py-1 font-mono text-[11px] rounded-sm transition-colors duration-75"
              style={{
                background:
                  view === v ? "var(--color-ink)" : "var(--color-surface)",
                color:
                  view === v
                    ? "var(--color-surface)"
                    : "var(--color-ink-secondary)",
                border:
                  view === v
                    ? "1px solid var(--color-ink)"
                    : "1px solid var(--color-rule-emphasis)",
              }}
            >
              {viewLabels[v]}
            </button>
          ))}
        </div>

        {view !== "benchmark" && hasBenchmark && (
          <>
            <div
              style={{
                width: "1px",
                height: "18px",
                background: "var(--color-rule-emphasis)",
              }}
            />
            <div className="flex items-center gap-2">
              <span
                className="font-mono text-[11px] uppercase tracking-widest"
                style={{ color: "var(--color-ink-muted)" }}
              >
                Source
              </span>
              {availableSources.map((s) => (
                <button
                  key={s}
                  onClick={() => setSource(s)}
                  className="px-2 py-0.5 font-mono text-[11px] rounded-sm transition-colors duration-75"
                  style={{
                    background:
                      source === s
                        ? "var(--color-surface-inset)"
                        : "transparent",
                    color:
                      source === s
                        ? "var(--color-ink)"
                        : "var(--color-ink-muted)",
                    border:
                      source === s
                        ? "1px solid var(--color-rule-strong)"
                        : "1px solid transparent",
                  }}
                >
                  {SOURCE_LABELS[s]}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {view === "grid" ? (
        <VariantGrid
          variants={entry.variants}
          onSave={source === "production" ? saveVariant : undefined}
        />
      ) : view === "compare" ? (
        <CompareView
          variants={entry.variants}
          onSave={source === "production" ? saveVariant : undefined}
        />
      ) : (
        <BenchmarkCompare entryId={entry.entry_id} />
      )}
    </div>
  );
}
