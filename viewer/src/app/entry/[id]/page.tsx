"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import type { EntryVariants } from "@/lib/types";
import { DomainBadge } from "@/components/DomainBadge";
import { VariantGrid } from "@/components/VariantGrid";
import { CompareView } from "@/components/CompareView";

export default function EntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [entry, setEntry] = useState<EntryVariants | null | undefined>(
    undefined
  );
  const [view, setView] = useState<"grid" | "compare">("grid");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch(`/api/entry/${id}`);
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
  }, [id]);

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

      <div className="flex gap-2 mb-4">
        {(["grid", "compare"] as const).map((v) => (
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
            {v === "grid" ? "Grid" : "Compare"}
          </button>
        ))}
      </div>

      {view === "grid" ? (
        <VariantGrid variants={entry.variants} />
      ) : (
        <CompareView variants={entry.variants} />
      )}
    </div>
  );
}
