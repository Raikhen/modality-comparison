"use client";

import { useState, useRef, useEffect } from "react";
import type { ToolDefinition as ToolDef } from "@/lib/types";

export function ToolDefinition({
  tool,
  editing = false,
  onToolChange,
}: {
  tool: ToolDef;
  editing?: boolean;
  onToolChange?: (tool: ToolDef) => void;
}) {
  const props = tool.input_schema?.properties ?? {};
  const required = new Set(tool.input_schema?.required ?? []);

  const [jsonText, setJsonText] = useState(() => JSON.stringify(tool, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setJsonText(JSON.stringify(tool, null, 2));
    setJsonError(null);
  }, [tool]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [editing, jsonText]);

  if (editing && onToolChange) {
    return (
      <div className="mb-2">
        <textarea
          ref={textareaRef}
          value={jsonText}
          onChange={(e) => {
            const val = e.target.value;
            setJsonText(val);
            try {
              const parsed = JSON.parse(val) as ToolDef;
              setJsonError(null);
              onToolChange(parsed);
            } catch {
              setJsonError("Invalid JSON");
            }
            e.target.style.height = "auto";
            e.target.style.height = e.target.scrollHeight + "px";
          }}
          className="w-full font-mono text-xs p-3 rounded-sm resize-none border-0 outline-none overflow-x-auto"
          style={{
            background: "var(--color-panel)",
            color: "var(--color-panel-text)",
          }}
        />
        {jsonError && (
          <div
            className="font-mono text-[11px] mt-1 px-1"
            style={{ color: "var(--color-required)" }}
          >
            {jsonError}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="font-mono text-xs p-3 rounded-sm mb-2 overflow-x-auto"
      style={{
        background: "var(--color-panel)",
        color: "var(--color-panel-text)",
      }}
    >
      <div
        className="font-semibold mb-1"
        style={{ color: "var(--color-panel-accent)" }}
      >
        {tool.name}
      </div>
      {tool.description && (
        <div className="mb-2" style={{ color: "var(--color-ink-muted)" }}>
          {tool.description}
        </div>
      )}
      {Object.keys(props).length > 0 && (
        <div>
          {Object.entries(props).map(([name, schema]) => (
            <div key={name} className="ml-2">
              <span style={{ color: "var(--color-amber-muted)" }}>{name}</span>
              <span style={{ color: "var(--color-ink-muted)" }}>
                : {schema.type}
              </span>
              {required.has(name) && (
                <span className="ml-1" style={{ color: "var(--color-required)" }}>
                  *
                </span>
              )}
              {schema.description && (
                <span
                  className="ml-2"
                  style={{ color: "var(--color-ink-muted)" }}
                >
                  // {schema.description}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
