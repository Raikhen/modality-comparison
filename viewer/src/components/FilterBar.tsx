"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function FilterBar({ domains }: { domains: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSearch = searchParams.get("q") ?? "";
  const currentDomain = searchParams.get("domain") ?? "";
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
    </div>
  );
}
