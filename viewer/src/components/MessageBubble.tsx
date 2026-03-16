"use client";

import { useRef, useEffect } from "react";

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
  onContentChange,
}: {
  role: string;
  content: string;
  isLastUser?: boolean;
  onContentChange?: (content: string) => void;
}) {
  const style = ROLE_STYLES[role] ?? ROLE_STYLES.user;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [content]);

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
      {onContentChange ? (
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => {
            onContentChange(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = e.target.scrollHeight + "px";
          }}
          className={`w-full text-xs leading-relaxed whitespace-pre-wrap break-words resize-none bg-transparent border-0 p-0 outline-none ${
            role === "system" ? "font-mono" : ""
          }`}
          style={{
            color:
              role === "system"
                ? "var(--color-ink-secondary)"
                : "var(--color-ink)",
          }}
        />
      ) : (
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
      )}
    </div>
  );
}
