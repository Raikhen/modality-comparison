"use client";

import { useId, useState } from "react";
import type { Variant } from "@/lib/types";
import { MODALITY_LABELS, TONE_LABELS } from "@/lib/types";
import { MessageThread } from "./MessageThread";
import { CollapsibleSection } from "./CollapsibleSection";
import { ToolDefinition } from "./ToolDefinition";
import { FileContent } from "./FileContent";

export function VariantCard({ variant }: { variant: Variant }) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const tools = variant.tools ?? [];
  const files = variant.files ?? {};
  const toolResponses = variant.tool_responses ?? {};
  const hasTools = tools.length > 0;
  const hasFiles = Object.keys(files).length > 0;
  const hasToolResponses = Object.keys(toolResponses).length > 0;

  return (
    <div
      className="rounded-sm overflow-hidden transition-colors duration-75"
      style={{
        background: "var(--color-surface)",
        border: expanded
          ? "1px solid var(--color-rule-strong)"
          : "1px solid var(--color-rule)",
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls={contentId}
        aria-label={`${TONE_LABELS[variant.tone]} ${MODALITY_LABELS[variant.modality]} variant`}
        className="w-full px-3 py-2 text-left transition-colors duration-75 cursor-pointer hover-raised"
        style={{
          background: expanded ? "var(--color-surface-raised)" : "transparent",
        }}
      >
        <p
          className="text-[11px] leading-relaxed line-clamp-2"
          style={{ color: "var(--color-ink-tertiary)" }}
        >
          {variant.prompt.slice(0, 180)}
          {variant.prompt.length > 180 ? "..." : ""}
        </p>
      </button>

      {expanded && (
        <div id={contentId} className="px-3 pb-3 space-y-2">
          <MessageThread variant={variant} />

          {hasTools && (
            <CollapsibleSection title={`Tools (${tools.length})`}>
              {tools.map((tool) => (
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
      )}
    </div>
  );
}
