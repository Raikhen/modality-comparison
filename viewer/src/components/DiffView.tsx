"use client";

import { useState } from "react";
import type { Variant, Modality } from "@/lib/types";
import { MODALITIES, MODALITY_LABELS, TONES, TONE_LABELS } from "@/lib/types";
import { wordDiff, type DiffSegment } from "@/lib/diff";

function DiffSegments({ segments }: { segments: DiffSegment[] }) {
  return (
    <div className="text-sm whitespace-pre-wrap break-words">
      {segments.map((seg, i) => {
        if (seg.type === "equal") return <span key={i}>{seg.text}</span>;
        if (seg.type === "added")
          return (
            <span key={i} className="bg-green-200 text-green-900">
              {seg.text}
            </span>
          );
        return (
          <span key={i} className="bg-red-200 text-red-900 line-through">
            {seg.text}
          </span>
        );
      })}
    </div>
  );
}

export function DiffView({ variants }: { variants: Variant[] }) {
  const [modality, setModality] = useState<Modality>("plain_text");

  const byTone = new Map<string, Variant>();
  for (const v of variants) {
    if (v.modality === modality) {
      byTone.set(v.tone, v);
    }
  }

  const verbatim = byTone.get("verbatim");
  const formal = byTone.get("formal");
  const casual = byTone.get("casual");

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm font-medium text-gray-600">Modality:</span>
        {MODALITIES.map((m) => (
          <button
            key={m}
            onClick={() => setModality(m)}
            className={`px-3 py-1 text-sm rounded ${
              modality === m
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {MODALITY_LABELS[m]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {TONES.map((tone) => {
          const variant = byTone.get(tone);
          if (!variant) return null;

          const base = verbatim?.prompt ?? "";
          const segments =
            tone === "verbatim"
              ? [{ text: variant.prompt, type: "equal" as const }]
              : wordDiff(base, variant.prompt);

          return (
            <div key={tone} className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-2">
                {TONE_LABELS[tone]}
              </h3>
              <DiffSegments segments={segments} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
