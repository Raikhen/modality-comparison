"use client";

import { useId, useState } from "react";

export function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <div
      className="rounded-sm mt-2"
      style={{ border: "1px solid var(--color-rule)" }}
    >
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={contentId}
        className="w-full flex items-center justify-between px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider cursor-pointer transition-colors duration-75 hover-raised"
        style={{
          color: "var(--color-ink-tertiary)",
          background: open ? "var(--color-surface-raised)" : "transparent",
        }}
      >
        <span>{title}</span>
        <svg
          className="w-2.5 h-2.5 transition-transform duration-100"
          viewBox="0 0 10 10"
          fill="currentColor"
          aria-hidden="true"
          style={{
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
          }}
        >
          <path d="M3 1L8 5L3 9Z" />
        </svg>
      </button>
      {open && (
        <div id={contentId} className="px-3 pb-3 pt-2">
          {children}
        </div>
      )}
    </div>
  );
}
