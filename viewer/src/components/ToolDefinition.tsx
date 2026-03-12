import type { ToolDefinition as ToolDef } from "@/lib/types";

export function ToolDefinition({ tool }: { tool: ToolDef }) {
  const props = tool.input_schema?.properties ?? {};
  const required = new Set(tool.input_schema?.required ?? []);

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
                <span className="ml-1" style={{ color: "#c27070" }}>
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
