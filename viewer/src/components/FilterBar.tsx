"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function FilterBar({
  domains,
  hasBenchmark = false,
}: {
  domains: string[];
  hasBenchmark?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSearch = searchParams.get("q") ?? "";
  const currentDomain = searchParams.get("domain") ?? "";
  const benchmarkOnly = searchParams.get("benchmark") === "1";
  const [searchValue, setSearchValue] = useState(currentSearch);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

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

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateParams("q", searchValue);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchValue, updateParams]);

  return (
    <div className="flex gap-3 items-center mb-4">
      <input
        type="text"
        placeholder="Search entries..."
        aria-label="Search entries"
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        className="font-mono text-xs px-3 py-1.5 flex-1 max-w-sm rounded-sm"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-rule-strong)",
          color: "var(--color-ink)",
        }}
      />
      <select
        value={currentDomain}
        aria-label="Filter by domain"
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
      {hasBenchmark && (
        <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap select-none">
          <span
            className="font-mono text-[11px] transition-colors duration-75"
            style={{
              color: benchmarkOnly ? "var(--color-amber)" : "var(--color-ink-muted)",
            }}
          >
            Benchmark only
          </span>
          <button
            role="switch"
            aria-checked={benchmarkOnly}
            aria-label="Benchmark only"
            onClick={() => updateParams("benchmark", benchmarkOnly ? "" : "1")}
            className="relative inline-flex items-center rounded-full transition-colors duration-75"
            style={{
              width: "28px",
              height: "16px",
              background: benchmarkOnly ? "var(--color-amber)" : "var(--color-rule-strong)",
            }}
          >
            <span
              className="block rounded-full bg-white transition-transform duration-75"
              style={{
                width: "12px",
                height: "12px",
                transform: benchmarkOnly ? "translateX(14px)" : "translateX(2px)",
              }}
            />
          </button>
        </label>
      )}
    </div>
  );
}
