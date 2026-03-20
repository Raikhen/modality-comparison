"use client";

import { useEffect, useState } from "react";
import type { EntryVariants, Modality, Variant, Source } from "@/lib/types";
import {
  MODALITIES,
  MODALITY_LABELS,
  SOURCE_LABELS,
} from "@/lib/types";
import { MessageThread } from "./MessageThread";
import { CollapsibleSection } from "./CollapsibleSection";
import { ToolDefinition } from "./ToolDefinition";
import { FileContent } from "./FileContent";

const BENCHMARK_SOURCES: Source[] = ["gemini", "deepseek"];

function paraphraseLabel(pid: number): string {
  return pid === 0 ? "Original" : `Paraphrase ${pid}`;
}

export function BenchmarkCompare({ entryId }: { entryId: number }) {
  const [data, setData] = useState<Record<Source, EntryVariants | null>>({
    production: null,
    gemini: null,
    deepseek: null,
  });
  const [loading, setLoading] = useState(true);
  const [selectedPid, setSelectedPid] = useState<number>(0);
  const [selectedModality, setSelectedModality] = useState<Modality>("agentic");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const results = await Promise.all(
        BENCHMARK_SOURCES.map(async (src) => {
          const res = await fetch(`/api/entry/${entryId}?source=${src}`);
          if (!res.ok) return [src, null] as const;
          return [src, await res.json()] as const;
        })
      );
      if (cancelled) return;
      const newData: Record<Source, EntryVariants | null> = {
        production: null,
        gemini: null,
        deepseek: null,
      };
      for (const [src, entry] of results) {
        newData[src] = entry;
      }
      setData(newData);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [entryId]);

  if (loading) {
    return (
      <div
        className="py-8 text-center font-mono text-xs"
        style={{ color: "var(--color-ink-muted)" }}
      >
        Loading benchmark data...
      </div>
    );
  }

  const gemini = data.gemini;
  const deepseek = data.deepseek;

  if (!gemini || !deepseek) {
    return (
      <div
        className="py-8 text-center font-mono text-xs"
        style={{ color: "var(--color-ink-muted)" }}
      >
        Benchmark data not available for both sources.
      </div>
    );
  }

  // Collect paraphrase IDs from both sources
  const allPids = new Set<number>();
  for (const v of gemini.variants) allPids.add(v.paraphrase_id);
  for (const v of deepseek.variants) allPids.add(v.paraphrase_id);
  const sortedPids = [...allPids].sort((a, b) => a - b);

  const geminiLookup = new Map<string, Variant>();
  for (const v of gemini.variants) geminiLookup.set(`${v.paraphrase_id}_${v.modality}`, v);

  const deepseekLookup = new Map<string, Variant>();
  for (const v of deepseek.variants) deepseekLookup.set(`${v.paraphrase_id}_${v.modality}`, v);

  const geminiVariant = geminiLookup.get(`${selectedPid}_${selectedModality}`);
  const deepseekVariant = deepseekLookup.get(`${selectedPid}_${selectedModality}`);

  return (
    <div>
      {/* Paraphrase selector */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className="font-mono text-[11px] uppercase tracking-widest"
          style={{ color: "var(--color-ink-muted)" }}
        >
          Paraphrase
        </span>
        {sortedPids.map((pid) => (
          <button
            key={pid}
            onClick={() => setSelectedPid(pid)}
            className="px-3 py-1 font-mono text-[11px] rounded-sm transition-colors duration-75"
            style={{
              background:
                selectedPid === pid ? "var(--color-ink)" : "var(--color-surface)",
              color:
                selectedPid === pid
                  ? "var(--color-surface)"
                  : "var(--color-ink-secondary)",
              border:
                selectedPid === pid
                  ? "1px solid var(--color-ink)"
                  : "1px solid var(--color-rule-emphasis)",
            }}
          >
            {paraphraseLabel(pid)}
          </button>
        ))}
      </div>

      {/* Modality selector */}
      <div className="flex items-center gap-2 mb-5">
        <span
          className="font-mono text-[11px] uppercase tracking-widest"
          style={{ color: "var(--color-ink-muted)" }}
        >
          Modality
        </span>
        {MODALITIES.map((m) => (
          <button
            key={m}
            onClick={() => setSelectedModality(m)}
            className="px-3 py-1 font-mono text-[11px] rounded-sm transition-colors duration-75"
            style={{
              background:
                selectedModality === m
                  ? "var(--color-ink)"
                  : "var(--color-surface)",
              color:
                selectedModality === m
                  ? "var(--color-surface)"
                  : "var(--color-ink-secondary)",
              border:
                selectedModality === m
                  ? "1px solid var(--color-ink)"
                  : "1px solid var(--color-rule-emphasis)",
            }}
          >
            {MODALITY_LABELS[m]}
          </button>
        ))}
      </div>

      {/* Side-by-side panels */}
      <div className="grid grid-cols-2 gap-4">
        <BenchmarkPanel label="Gemini" variant={geminiVariant} />
        <BenchmarkPanel label="DeepSeek" variant={deepseekVariant} />
      </div>

      {/* Quick stats comparison */}
      {geminiVariant && deepseekVariant && (
        <div
          className="mt-4 p-3 rounded-sm"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-rule)",
          }}
        >
          <QuickStats gemini={geminiVariant} deepseek={deepseekVariant} />
        </div>
      )}
    </div>
  );
}

function BenchmarkPanel({
  label,
  variant,
}: {
  label: string;
  variant: Variant | undefined;
}) {
  if (!variant) {
    return (
      <div
        className="rounded-sm p-4"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-rule)",
        }}
      >
        <div
          className="font-mono text-[11px] uppercase tracking-widest mb-3"
          style={{ color: "var(--color-ink-muted)" }}
        >
          {label}
        </div>
        <div
          className="text-[11px] font-mono italic"
          style={{ color: "var(--color-ink-muted)" }}
        >
          missing
        </div>
      </div>
    );
  }

  const files = variant.files ?? {};
  const toolResponses = variant.tool_responses ?? {};
  const hasTools = (variant.tools ?? []).length > 0;
  const hasFiles = Object.keys(files).length > 0;
  const hasToolResponses = Object.keys(toolResponses).length > 0;

  return (
    <div
      className="rounded-sm overflow-hidden"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-rule)",
      }}
    >
      <div
        className="px-3 py-2"
        style={{
          borderBottom: "1px solid var(--color-rule)",
          background: "var(--color-surface-raised)",
        }}
      >
        <span
          className="font-mono text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--color-ink-tertiary)" }}
        >
          {label}
        </span>
        <span
          className="font-mono text-[11px] ml-3 tabular-nums"
          style={{ color: "var(--color-ink-muted)" }}
        >
          {variant.prompt.split(/\s+/).length} words
        </span>
      </div>

      <div className="px-3 py-3 space-y-2">
        <MessageThread variant={variant} />

        {hasTools && (
          <CollapsibleSection title={`Tools (${(variant.tools ?? []).length})`}>
            {(variant.tools ?? []).map((tool) => (
              <ToolDefinition key={tool.name} tool={tool} />
            ))}
          </CollapsibleSection>
        )}

        {hasFiles && (
          <CollapsibleSection
            title={`Files (${Object.keys(files).length})`}
          >
            <FileContent files={files} />
          </CollapsibleSection>
        )}

        {hasToolResponses && (
          <CollapsibleSection
            title={`Tool Responses (${Object.keys(toolResponses).length})`}
          >
            <div className="space-y-2">
              {Object.entries(toolResponses).map(([name, response]) => (
                <div key={name}>
                  <div
                    className="text-[11px] font-mono uppercase tracking-wider mb-1"
                    style={{ color: "var(--color-ink-muted)" }}
                  >
                    {name}
                  </div>
                  <pre
                    className="font-mono text-xs p-3 rounded-sm overflow-x-auto whitespace-pre-wrap"
                    style={{
                      background: "var(--color-panel)",
                      color: "var(--color-panel-text)",
                    }}
                  >
                    {response}
                  </pre>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}
      </div>
    </div>
  );
}

function QuickStats({
  gemini,
  deepseek,
}: {
  gemini: Variant;
  deepseek: Variant;
}) {
  const stats = [
    {
      label: "Prompt words",
      gemini: gemini.prompt.split(/\s+/).length,
      deepseek: deepseek.prompt.split(/\s+/).length,
    },
    {
      label: "System prompt words",
      gemini: gemini.system_prompt?.split(/\s+/).filter(Boolean).length ?? 0,
      deepseek: deepseek.system_prompt?.split(/\s+/).filter(Boolean).length ?? 0,
    },
    {
      label: "Tools",
      gemini: gemini.tools?.length ?? 0,
      deepseek: deepseek.tools?.length ?? 0,
    },
    {
      label: "Files",
      gemini: Object.keys(gemini.files ?? {}).length,
      deepseek: Object.keys(deepseek.files ?? {}).length,
    },
    {
      label: "History turns",
      gemini: gemini.conversation_history?.length ?? 0,
      deepseek: deepseek.conversation_history?.length ?? 0,
    },
    {
      label: "Tool responses",
      gemini: Object.keys(gemini.tool_responses ?? {}).length,
      deepseek: Object.keys(deepseek.tool_responses ?? {}).length,
    },
  ];

  // Filter out zero-zero rows
  const visible = stats.filter((s) => s.gemini > 0 || s.deepseek > 0);

  return (
    <table className="w-full">
      <thead>
        <tr>
          <th
            className="text-left font-mono text-[11px] uppercase tracking-widest pb-1"
            style={{ color: "var(--color-ink-muted)" }}
          />
          <th
            className="text-right font-mono text-[11px] uppercase tracking-widest pb-1"
            style={{ color: "var(--color-ink-muted)", width: "100px" }}
          >
            Gemini
          </th>
          <th
            className="text-right font-mono text-[11px] uppercase tracking-widest pb-1"
            style={{ color: "var(--color-ink-muted)", width: "100px" }}
          >
            DeepSeek
          </th>
        </tr>
      </thead>
      <tbody>
        {visible.map((s) => (
          <tr key={s.label} style={{ borderTop: "1px solid var(--color-rule)" }}>
            <td
              className="py-1 font-mono text-[11px]"
              style={{ color: "var(--color-ink-tertiary)" }}
            >
              {s.label}
            </td>
            <td
              className="py-1 text-right font-mono text-[11px] tabular-nums"
              style={{ color: "var(--color-ink-secondary)" }}
            >
              {s.gemini}
            </td>
            <td
              className="py-1 text-right font-mono text-[11px] tabular-nums"
              style={{ color: "var(--color-ink-secondary)" }}
            >
              {s.deepseek}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
