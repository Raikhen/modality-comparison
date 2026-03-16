"use client";

import { useId, useState, useCallback } from "react";
import type { Variant, SaveVariantFn, VariantPatch } from "@/lib/types";
import type { ToolDefinition as ToolDef } from "@/lib/types";
import { MODALITY_LABELS, TONE_LABELS } from "@/lib/types";
import { MessageThread } from "./MessageThread";
import { CollapsibleSection } from "./CollapsibleSection";
import { ToolDefinition } from "./ToolDefinition";
import { FileContent } from "./FileContent";

export function VariantCard({
  variant,
  onSave,
}: {
  variant: Variant;
  onSave?: SaveVariantFn;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<VariantPatch>({});
  const contentId = useId();

  const tools = editing && draft.tools ? draft.tools : (variant.tools ?? []);
  const files = variant.files ?? {};
  const toolResponses = variant.tool_responses ?? {};
  const hasTools = (variant.tools ?? []).length > 0;
  const hasFiles = Object.keys(files).length > 0;
  const hasToolResponses = Object.keys(toolResponses).length > 0;

  const startEditing = useCallback(() => {
    setDraft({});
    setEditing(true);
  }, []);

  const cancel = useCallback(() => {
    setDraft({});
    setEditing(false);
  }, []);

  const save = useCallback(async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(variant.tone, variant.modality, draft);
      setEditing(false);
      setDraft({});
    } finally {
      setSaving(false);
    }
  }, [onSave, variant.tone, variant.modality, draft]);

  // Build a working variant that reflects draft edits for MessageThread
  const workingVariant: Variant = {
    ...variant,
    ...(draft.prompt !== undefined ? { prompt: draft.prompt } : {}),
    ...(draft.system_prompt !== undefined ? { system_prompt: draft.system_prompt } : {}),
    ...(draft.conversation_history !== undefined
      ? { conversation_history: draft.conversation_history }
      : {}),
    ...(draft.tools !== undefined ? { tools: draft.tools } : {}),
  };

  return (
    <div
      className="rounded-sm overflow-hidden transition-colors duration-75"
      style={{
        background: "var(--color-surface)",
        borderLeft: editing
          ? "1px solid var(--color-amber-rule)"
          : expanded
            ? "1px solid var(--color-rule-strong)"
            : "1px solid var(--color-rule)",
        borderRight: editing
          ? "1px solid var(--color-amber-rule)"
          : expanded
            ? "1px solid var(--color-rule-strong)"
            : "1px solid var(--color-rule)",
        borderBottom: editing
          ? "1px solid var(--color-amber-rule)"
          : expanded
            ? "1px solid var(--color-rule-strong)"
            : "1px solid var(--color-rule)",
        borderTop: editing
          ? "2px solid var(--color-amber-rule)"
          : expanded
            ? "1px solid var(--color-rule-strong)"
            : "1px solid var(--color-rule)",
      }}
    >
      <button
        onClick={() => {
          if (!editing) setExpanded(!expanded);
        }}
        aria-expanded={expanded}
        aria-controls={contentId}
        aria-label={`${TONE_LABELS[variant.tone]} ${MODALITY_LABELS[variant.modality]} variant`}
        className="w-full px-3 py-2 text-left transition-colors duration-75 cursor-pointer hover-raised"
        style={{
          background: expanded ? "var(--color-surface-raised)" : "transparent",
        }}
      >
        <div className="flex items-center justify-between">
          <p
            className="text-[11px] leading-relaxed line-clamp-2 flex-1"
            style={{ color: "var(--color-ink-tertiary)" }}
          >
            {variant.prompt.slice(0, 180)}
            {variant.prompt.length > 180 ? "..." : ""}
          </p>
          {expanded && onSave && !editing && (
            <span
              className="font-mono text-[11px] ml-2 shrink-0 transition-colors duration-75"
              style={{ color: "var(--color-ink-muted)" }}
              onClick={(e) => {
                e.stopPropagation();
                startEditing();
              }}
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
                  e.stopPropagation();
                  e.preventDefault();
                  startEditing();
                }
              }}
            >
              Edit
            </span>
          )}
        </div>
      </button>

      {expanded && (
        <div id={contentId} className="px-3 pb-3 space-y-2">
          <MessageThread
            variant={workingVariant}
            editing={editing}
            onSystemPromptChange={(content) =>
              setDraft((d) => ({ ...d, system_prompt: content }))
            }
            onHistoryChange={(index, content) =>
              setDraft((d) => {
                const history = [
                  ...(d.conversation_history ?? variant.conversation_history ?? []),
                ];
                history[index] = { ...history[index], content };
                return { ...d, conversation_history: history };
              })
            }
            onPromptChange={(content) =>
              setDraft((d) => ({ ...d, prompt: content }))
            }
          />

          {hasTools && (
            <CollapsibleSection title={`Tools (${tools.length})`}>
              {tools.map((tool, i) => (
                <ToolDefinition
                  key={editing ? `edit-${i}` : tool.name}
                  tool={tool}
                  editing={editing}
                  onToolChange={(updated: ToolDef) =>
                    setDraft((d) => {
                      const newTools = [...(d.tools ?? variant.tools ?? [])];
                      newTools[i] = updated;
                      return { ...d, tools: newTools };
                    })
                  }
                />
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

          {editing && (
            <div className="flex gap-2 pt-1">
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
          )}
        </div>
      )}
    </div>
  );
}
