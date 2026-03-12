"use client";

import { useState } from "react";
import type { Variant, Modality } from "@/lib/types";
import { MODALITIES, MODALITY_LABELS, TONES, TONE_LABELS } from "@/lib/types";

export function CompareView({ variants }: { variants: Variant[] }) {
  const [modality, setModality] = useState<Modality>("plain_text");

  const byTone = new Map<string, Variant>();
  for (const v of variants) {
    if (v.modality === modality) {
      byTone.set(v.tone, v);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span
          className="font-mono text-[10px] uppercase tracking-widest"
          style={{ color: "var(--color-ink-muted)" }}
        >
          Modality
        </span>
        {MODALITIES.map((m) => (
          <button
            key={m}
            onClick={() => setModality(m)}
            className="px-3 py-1 font-mono text-[11px] rounded-sm transition-colors duration-75"
            style={{
              background:
                modality === m ? "var(--color-ink)" : "var(--color-surface)",
              color:
                modality === m
                  ? "var(--color-surface)"
                  : "var(--color-ink-secondary)",
              border:
                modality === m
                  ? "1px solid var(--color-ink)"
                  : "1px solid var(--color-rule-emphasis)",
            }}
          >
            {MODALITY_LABELS[m]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {TONES.map((tone) => {
          const variant = byTone.get(tone);
          if (!variant) return null;

          return (
            <div
              key={tone}
              className="rounded-sm p-4"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-rule)",
              }}
            >
              <h3
                className="font-mono text-[10px] uppercase tracking-widest mb-3"
                style={{ color: "var(--color-ink-tertiary)" }}
              >
                {TONE_LABELS[tone]}
              </h3>
              <div
                className="text-xs leading-relaxed whitespace-pre-wrap break-words"
                style={{ color: "var(--color-ink-secondary)" }}
              >
                {variant.prompt}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
