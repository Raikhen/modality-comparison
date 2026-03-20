import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { EntryVariants, EntrySummary, Modality, VariantPatch, Source, Variant } from "./types";

const DATA_DIR = path.resolve(process.cwd(), "..", "data");
const DATASET_PATH = path.join(DATA_DIR, "dataset.csv");
const VARIANTS_DIR = path.join(DATA_DIR, "variants");

const SOURCE_DIRS: Record<Source, string> = {
  production: path.join(VARIANTS_DIR, "claude"),
  gemini: path.join(VARIANTS_DIR, "gemini"),
  deepseek: path.join(VARIANTS_DIR, "deepseek"),
};

/** Map old tone-based variants to paraphrase_id for backward compatibility. */
const TONE_TO_PARAPHRASE: Record<string, number> = {
  verbatim: 0,
  formal: 1,
  casual: 2,
};

function normalizeVariants(data: EntryVariants): EntryVariants {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = data.variants as any[];
  const needsNormalization = raw.some(
    (v) => "tone" in v && !("paraphrase_id" in v)
  );
  if (!needsNormalization) return data;

  const normalized: Variant[] = raw.map((v) => {
    if ("tone" in v && !("paraphrase_id" in v)) {
      const tone = v.tone as string;
      const { tone: _, ...rest } = v;
      return { ...rest, paraphrase_id: TONE_TO_PARAPHRASE[tone] ?? 0 } as Variant;
    }
    return v as Variant;
  });

  const maxPid = Math.max(...normalized.map((v) => v.paraphrase_id));
  return {
    ...data,
    num_paraphrases: data.num_paraphrases ?? maxPid + 1,
    variants: normalized,
  };
}

/** Parse dataset.csv and return all entries. */
function loadDatasetEntries(): { id: number; risk_domain: string; prompt: string }[] {
  if (!fs.existsSync(DATASET_PATH)) return [];
  const raw = fs.readFileSync(DATASET_PATH, "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim());
  // CSV columns: ID, adversarial_prompt, rubric, risk_domain, ...
  // Use a simple CSV parser that handles quoted fields with commas/newlines
  const results: { id: number; risk_domain: string; prompt: string }[] = [];
  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length < 4) continue;
    const id = parseInt(fields[0], 10);
    if (isNaN(id)) continue;
    results.push({ id, risk_domain: fields[3], prompt: fields[1] });
  }
  return results;
}

/** Minimal CSV line parser that handles quoted fields. */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      // Quoted field
      i++;
      let field = "";
      while (i < line.length) {
        if (line[i] === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            i++; // closing quote
            break;
          }
        } else {
          field += line[i];
          i++;
        }
      }
      fields.push(field);
      if (i < line.length && line[i] === ',') i++; // skip delimiter
    } else {
      // Unquoted field
      const next = line.indexOf(',', i);
      if (next === -1) {
        fields.push(line.slice(i));
        break;
      }
      fields.push(line.slice(i, next));
      i = next + 1;
    }
  }
  return fields;
}

export function getAllEntries(): EntrySummary[] {
  const dataset = loadDatasetEntries();

  // Build a set of entry IDs that have variant files in any source
  const variantIds = new Set<number>();
  for (const dir of Object.values(SOURCE_DIRS)) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith(".json") && !f.startsWith("_")) {
        const id = parseInt(f.replace(".json", ""), 10);
        if (!isNaN(id)) variantIds.add(id);
      }
    }
  }

  // Build benchmark source lookup
  const benchmarkMap = new Map<number, Source[]>();
  for (const src of ["gemini", "deepseek"] as const) {
    const dir = SOURCE_DIRS[src];
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".json") || f.startsWith("_")) continue;
      const id = parseInt(f.replace(".json", ""), 10);
      if (isNaN(id)) continue;
      if (!benchmarkMap.has(id)) benchmarkMap.set(id, []);
      benchmarkMap.get(id)!.push(src);
    }
  }

  return dataset.map((row) => {
    const benchmarkSources = benchmarkMap.get(row.id);
    return {
      entry_id: row.id,
      risk_domain: row.risk_domain,
      prompt_preview: row.prompt.slice(0, 150),
      has_variants: variantIds.has(row.id),
      ...(benchmarkSources ? { benchmark_sources: benchmarkSources } : {}),
    };
  });
}

/** Look up basic entry info from dataset.csv (without variant data). */
export function getDatasetEntry(id: number): { entry_id: number; original_prompt: string; risk_domain: string } | null {
  const all = loadDatasetEntries();
  const row = all.find((r) => r.id === id);
  if (!row) return null;
  return { entry_id: row.id, original_prompt: row.prompt, risk_domain: row.risk_domain };
}

export function getEntry(id: number): EntryVariants | null {
  // Try production first, then fall back to benchmark sources
  for (const src of ["production", "gemini", "deepseek"] as const) {
    const result = getEntryFromSource(id, src);
    if (result) return result;
  }
  return null;
}

export function getDefaultSource(id: number): Source {
  for (const src of ["production", "gemini", "deepseek"] as const) {
    const filePath = path.join(SOURCE_DIRS[src], `${id}.json`);
    if (fs.existsSync(filePath)) return src;
  }
  return "production";
}

export function getEntryFromSource(id: number, source: Source): EntryVariants | null {
  const dir = SOURCE_DIRS[source];
  if (!dir) return null;
  const filePath = path.join(dir, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as EntryVariants;
    return normalizeVariants(data);
  } catch {
    return null;
  }
}

export function getBenchmarkSources(id: number): Source[] {
  const sources: Source[] = [];
  for (const src of ["gemini", "deepseek"] as const) {
    const filePath = path.join(SOURCE_DIRS[src], `${id}.json`);
    if (fs.existsSync(filePath)) sources.push(src);
  }
  return sources;
}

export function getAvailableSources(id: number): Source[] {
  const sources: Source[] = [];
  for (const src of ["production", "gemini", "deepseek"] as const) {
    const filePath = path.join(SOURCE_DIRS[src], `${id}.json`);
    if (fs.existsSync(filePath)) sources.push(src);
  }
  return sources;
}

export function updateVariant(
  entryId: number,
  paraphraseId: number,
  modality: Modality,
  patch: VariantPatch
): EntryVariants {
  const filePath = path.join(SOURCE_DIRS.production, `${entryId}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Entry ${entryId} not found`);
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw) as EntryVariants;

  const variant = data.variants.find(
    (v) => v.paraphrase_id === paraphraseId && v.modality === modality
  );
  if (!variant) {
    throw new Error(`Variant p${paraphraseId}/${modality} not found in entry ${entryId}`);
  }

  Object.assign(variant, patch);

  // Atomic write: temp file then rename
  const tmpPath = filePath + "." + crypto.randomBytes(4).toString("hex") + ".tmp";
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2) + "\n", "utf-8");
  fs.renameSync(tmpPath, filePath);

  return data;
}
