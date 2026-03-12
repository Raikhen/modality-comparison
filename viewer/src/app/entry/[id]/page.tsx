"use client";

import { use, useState } from "react";
import Link from "next/link";
import type { EntryVariants } from "@/lib/types";
import { DomainBadge } from "@/components/DomainBadge";
import { VariantGrid } from "@/components/VariantGrid";

async function fetchEntry(id: string): Promise<EntryVariants | null> {
  const res = await fetch(`/api/entry/${id}`);
  if (!res.ok) return null;
  return res.json();
}

export default function EntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [entry, setEntry] = useState<EntryVariants | null | undefined>(
    undefined
  );

  if (entry === undefined) {
    fetchEntry(id).then(setEntry);
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
          className="font-mono text-[11px] mb-3 inline-block transition-colors duration-75"
          style={{ color: "var(--color-ink-muted)" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = "var(--color-ink)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = "var(--color-ink-muted)")
          }
        >
          &larr; all entries
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

      <VariantGrid variants={entry.variants} />
    </div>
  );
}
