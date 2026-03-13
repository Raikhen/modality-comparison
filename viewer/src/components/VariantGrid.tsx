"use client";

import type { Variant } from "@/lib/types";
import { TONES, MODALITIES, MODALITY_LABELS, TONE_LABELS } from "@/lib/types";
import { VariantCard } from "./VariantCard";

export function VariantGrid({ variants }: { variants: Variant[] }) {
  const lookup = new Map<string, Variant>();
  for (const v of variants) {
    lookup.set(`${v.tone}_${v.modality}`, v);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th
              className="p-2 text-left font-mono text-[11px] uppercase tracking-widest"
              style={{ color: "var(--color-ink-muted)", width: "80px" }}
            >
              <span className="sr-only">Tone</span>
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
          {TONES.map((t) => (
            <tr
              key={t}
              style={{ borderTop: "1px solid var(--color-rule)" }}
            >
              <td
                className="p-2 font-mono text-[11px] uppercase tracking-widest align-top whitespace-nowrap"
                style={{ color: "var(--color-ink-tertiary)" }}
              >
                {TONE_LABELS[t]}
              </td>
              {MODALITIES.map((m) => {
                const variant = lookup.get(`${t}_${m}`);
                return (
                  <td key={m} className="p-2 align-top">
                    {variant ? (
                      <VariantCard variant={variant} />
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
