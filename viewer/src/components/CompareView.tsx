"use client";

import { useState, useCallback } from "react";
import type { Variant, Modality, SaveVariantFn, VariantPatch } from "@/lib/types";
import { MODALITIES, MODALITY_LABELS, TONES, TONE_LABELS } from "@/lib/types";

export function CompareView({
  variants,
  onSave,
}: {
  variants: Variant[];
  onSave?: SaveVariantFn;
}) {
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
          className="font-mono text-[11px] uppercase tracking-widest"
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {TONES.map((tone) => {
          const variant = byTone.get(tone);
          if (!variant) return null;

          return (
            <CompareCard
              key={tone}
              variant={variant}
              onSave={onSave}
            />
          );
        })}
      </div>
      {byTone.size === 0 && (
        <div
          className="py-8 text-center font-mono text-xs"
          style={{ color: "var(--color-ink-muted)" }}
        >
          No variants for this modality.
        </div>
      )}
    </div>
  );
}

function CompareCard({
  variant,
  onSave,
}: {
  variant: Variant;
  onSave?: SaveVariantFn;
}) {
  const [editing, setEditing] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState(variant.prompt);
  const [saving, setSaving] = useState(false);

  const startEditing = useCallback(() => {
    setDraftPrompt(variant.prompt);
    setEditing(true);
  }, [variant.prompt]);

  const cancel = useCallback(() => {
    setEditing(false);
  }, []);

  const save = useCallback(async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(variant.tone, variant.modality, { prompt: draftPrompt });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }, [onSave, variant.tone, variant.modality, draftPrompt]);

  return (
    <div
      className="rounded-sm p-4"
      style={{
        background: "var(--color-surface)",
        borderLeft: editing
          ? "1px solid var(--color-amber-rule)"
          : "1px solid var(--color-rule)",
        borderRight: editing
          ? "1px solid var(--color-amber-rule)"
          : "1px solid var(--color-rule)",
        borderBottom: editing
          ? "1px solid var(--color-amber-rule)"
          : "1px solid var(--color-rule)",
        borderTop: editing
          ? "2px solid var(--color-amber-rule)"
          : "1px solid var(--color-rule)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3
          className="font-mono text-[11px] uppercase tracking-widest"
          style={{ color: "var(--color-ink-tertiary)" }}
        >
          {TONE_LABELS[variant.tone]}
        </h3>
        {onSave && !editing && (
          <span
            className="font-mono text-[11px] transition-colors duration-75 cursor-pointer"
            style={{ color: "var(--color-ink-muted)" }}
            onClick={startEditing}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.color = "var(--color-amber)";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.color = "var(--color-ink-muted)";
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                startEditing();
              }
            }}
          >
            Edit
          </span>
        )}
      </div>
      {editing ? (
        <>
          <textarea
            value={draftPrompt}
            onChange={(e) => setDraftPrompt(e.target.value)}
            className="w-full text-xs leading-relaxed whitespace-pre-wrap break-words resize-none bg-transparent border-0 p-0 outline-none mb-2"
            style={{ color: "var(--color-ink-secondary)", minHeight: "100px" }}
          />
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="px-3 py-1 font-mono text-[11px] rounded-sm transition-colors duration-75"
              style={{
                background: "var(--color-amber)",
                color: "var(--color-surface)",
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={cancel}
              disabled={saving}
              className="px-3 py-1 font-mono text-[11px] rounded-sm transition-colors duration-75"
              style={{
                color: "var(--color-ink-muted)",
                border: "1px solid var(--color-rule-emphasis)",
                background: "var(--color-surface)",
              }}
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <div
          className="text-xs leading-relaxed whitespace-pre-wrap break-words"
          style={{ color: "var(--color-ink-secondary)" }}
        >
          {variant.prompt}
        </div>
      )}
    </div>
  );
}
