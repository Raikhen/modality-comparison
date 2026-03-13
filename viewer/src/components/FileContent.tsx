export function FileContent({ files }: { files: Record<string, string> }) {
  return (
    <div className="space-y-2">
      {Object.entries(files).map(([name, content]) => (
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
            {content}
          </pre>
        </div>
      ))}
    </div>
  );
}
