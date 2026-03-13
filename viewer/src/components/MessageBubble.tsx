const ROLE_STYLES: Record<
  string,
  { bg: string; border: string; label: string }
> = {
  system: {
    bg: "var(--color-system-surface)",
    border: "var(--color-system-rule)",
    label: "System",
  },
  user: {
    bg: "var(--color-user-surface)",
    border: "var(--color-user-rule)",
    label: "User",
  },
  assistant: {
    bg: "var(--color-assistant-surface)",
    border: "var(--color-assistant-rule)",
    label: "Assistant",
  },
};

export function MessageBubble({
  role,
  content,
  isLastUser = false,
}: {
  role: string;
  content: string;
  isLastUser?: boolean;
}) {
  const style = ROLE_STYLES[role] ?? ROLE_STYLES.user;

  return (
    <div
      className="rounded-sm p-3"
      style={{
        background: isLastUser ? "var(--color-amber-surface)" : style.bg,
        borderLeft: `3px solid ${isLastUser ? "var(--color-amber)" : style.border}`,
      }}
    >
      <div className="flex items-baseline gap-2 mb-1">
        <span
          className="font-mono text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--color-ink-muted)" }}
        >
          {style.label}
        </span>
        {isLastUser && (
          <span
            className="font-mono text-[11px] font-medium tracking-wide"
            style={{ color: "var(--color-amber)" }}
          >
            FINAL PROMPT
          </span>
        )}
      </div>
      <div
        className={`text-xs leading-relaxed whitespace-pre-wrap break-words ${
          role === "system" ? "font-mono" : ""
        }`}
        style={{
          color:
            role === "system"
              ? "var(--color-ink-secondary)"
              : "var(--color-ink)",
        }}
      >
        {content}
      </div>
    </div>
  );
}
