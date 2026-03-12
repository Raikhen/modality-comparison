import { Suspense } from "react";
import { getAllEntries } from "@/lib/variants";
import { EntryTable } from "@/components/EntryTable";

export default function HomePage() {
  const entries = getAllEntries();
  const domains = [...new Set(entries.map((e) => e.risk_domain))].sort();

  return (
    <div>
      <Suspense fallback={<div className="text-gray-500">Loading...</div>}>
        <EntryTable entries={entries} domains={domains} />
      </Suspense>
    </div>
  );
}
