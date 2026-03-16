import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { EntryVariants, EntrySummary, Modality, VariantPatch, Source, Variant } from "./types";

const VARIANTS_DIR = path.resolve(process.cwd(), "..", "data", "variants");

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

export function getAllEntries(): EntrySummary[] {
  // Collect unique JSON filenames across all source directories
  const allFiles = new Set<string>();
  for (const dir of Object.values(SOURCE_DIRS)) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith(".json") && !f.startsWith("_")) allFiles.add(f);
    }
  }

  const entries: EntrySummary[] = [];
  const seen = new Set<number>();

  for (const file of allFiles) {
    try {
      // Read from production first, fall back to any benchmark source
      let data: EntryVariants | null = null;
      for (const src of ["production", "gemini", "deepseek"] as const) {
        const filePath = path.join(SOURCE_DIRS[src], file);
        if (fs.existsSync(filePath)) {
          data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as EntryVariants;
          break;
        }
      }
      if (!data || seen.has(data.entry_id)) continue;
      seen.add(data.entry_id);

      const benchmarkSources: Source[] = [];
      for (const src of ["gemini", "deepseek"] as const) {
        if (fs.existsSync(path.join(SOURCE_DIRS[src], file))) benchmarkSources.push(src);
      }

      entries.push({
        entry_id: data.entry_id,
        risk_domain: data.risk_domain,
        prompt_preview: data.original_prompt.slice(0, 150),
        ...(benchmarkSources.length > 0 ? { benchmark_sources: benchmarkSources } : {}),
      });
    } catch {
      // skip malformed files
    }
  }

  return entries.sort((a, b) => a.entry_id - b.entry_id);
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
