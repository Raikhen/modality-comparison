"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export function FilterBar({ domains }: { domains: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSearch = searchParams.get("q") ?? "";
  const currentDomain = searchParams.get("domain") ?? "";

  const updateParams = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  return (
    <div className="flex gap-3 items-center mb-4">
      <input
        type="text"
        placeholder="Search entries..."
        defaultValue={currentSearch}
        onChange={(e) => updateParams("q", e.target.value)}
        className="font-mono text-xs px-3 py-1.5 flex-1 max-w-sm rounded-sm"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-rule-strong)",
          color: "var(--color-ink)",
        }}
      />
      <select
        defaultValue={currentDomain}
        onChange={(e) => updateParams("domain", e.target.value)}
        className="font-mono text-xs px-3 py-1.5 rounded-sm appearance-auto"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-rule-strong)",
          color: "var(--color-ink)",
        }}
      >
        <option value="">All domains</option>
        {domains.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
    </div>
  );
}
