"use client";

import type { Variant, SaveVariantFn } from "@/lib/types";
import { MODALITIES, MODALITY_LABELS } from "@/lib/types";
import { VariantCard } from "./VariantCard";

function paraphraseLabel(pid: number): string {
  return pid === 0 ? "Original" : `Paraphrase ${pid}`;
}

export function VariantGrid({
  variants,
  onSave,
}: {
  variants: Variant[];
  onSave?: SaveVariantFn;
}) {
  const lookup = new Map<string, Variant>();
  const paraphraseIds = new Set<number>();
  for (const v of variants) {
    lookup.set(`${v.paraphrase_id}_${v.modality}`, v);
    paraphraseIds.add(v.paraphrase_id);
  }
  const sortedPids = [...paraphraseIds].sort((a, b) => a - b);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th
              className="p-2 text-left font-mono text-[11px] uppercase tracking-widest"
              style={{ color: "var(--color-ink-muted)", width: "100px" }}
            >
              <span className="sr-only">Paraphrase</span>
            </th>
            {MODALITIES.map((m) => (
              <th
                key={m}
                className="p-2 text-center font-mono text-[11px] uppercase tracking-widest min-w-[280px]"
                style={{ color: "var(--color-ink-tertiary)" }}
              >
                {MODALITY_LABELS[m]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedPids.map((pid) => (
            <tr
              key={pid}
              style={{ borderTop: "1px solid var(--color-rule)" }}
            >
              <td
                className="p-2 font-mono text-[11px] uppercase tracking-widest align-top whitespace-nowrap"
                style={{ color: "var(--color-ink-tertiary)" }}
              >
                {paraphraseLabel(pid)}
              </td>
              {MODALITIES.map((m) => {
                const variant = lookup.get(`${pid}_${m}`);
                return (
                  <td key={m} className="p-2 align-top">
                    {variant ? (
                      <VariantCard variant={variant} onSave={onSave} />
                    ) : (
                      <div
                        className="text-[11px] font-mono italic p-3"
                        style={{ color: "var(--color-ink-muted)" }}
                      >
                        missing
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
