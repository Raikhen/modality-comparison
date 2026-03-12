import fs from "fs";
import path from "path";
import type { EntryVariants, EntrySummary } from "./types";

const VARIANTS_DIR = path.resolve(process.cwd(), "..", "variants");

export function getAllEntries(): EntrySummary[] {
  if (!fs.existsSync(VARIANTS_DIR)) return [];

  const files = fs
    .readdirSync(VARIANTS_DIR)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"));

  const entries: EntrySummary[] = [];

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(VARIANTS_DIR, file), "utf-8");
      const data = JSON.parse(raw) as EntryVariants;
      entries.push({
        entry_id: data.entry_id,
        risk_domain: data.risk_domain,
        prompt_preview: data.original_prompt.slice(0, 150),
      });
    } catch {
      // skip malformed files
    }
  }

  return entries.sort((a, b) => a.entry_id - b.entry_id);
}

export function getEntry(id: number): EntryVariants | null {
  const filePath = path.join(VARIANTS_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as EntryVariants;
  } catch {
    return null;
  }
}
