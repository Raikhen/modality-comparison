import { NextResponse } from "next/server";
import { getEntry, getEntryFromSource, getDefaultSource, getBenchmarkSources, getAvailableSources, getDatasetEntry, updateVariant } from "@/lib/variants";
import { MODALITIES } from "@/lib/types";
import type { Modality, VariantPatch, Source } from "@/lib/types";

const VALID_SOURCES = new Set<Source>(["production", "gemini", "deepseek"]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const entryId = parseInt(id, 10);
  if (isNaN(entryId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const url = new URL(request.url);
  const source = (url.searchParams.get("source") ?? "production") as Source;
  if (!VALID_SOURCES.has(source)) {
    return NextResponse.json({ error: "Invalid source" }, { status: 400 });
  }

  // Special case: return benchmark metadata + default source
  if (url.searchParams.get("meta") === "sources") {
    const sources = getBenchmarkSources(entryId);
    const available = getAvailableSources(entryId);
    const defaultSource = getDefaultSource(entryId);
    return NextResponse.json({ entry_id: entryId, benchmark_sources: sources, available_sources: available, default_source: defaultSource });
  }

  // If no explicit source, use the default (production first, then benchmarks)
  const resolvedSource = url.searchParams.has("source") ? source : getDefaultSource(entryId);
  const entry = getEntryFromSource(entryId, resolvedSource);
  if (!entry) {
    // Return basic info from dataset.csv with empty variants
    const datasetEntry = getDatasetEntry(entryId);
    if (!datasetEntry) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ...datasetEntry, variants: [] });
  }

  return NextResponse.json(entry);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const entryId = parseInt(id, 10);
  if (isNaN(entryId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  let body: { paraphrase_id: number; modality: string; patch: VariantPatch };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { paraphrase_id, modality, patch } = body;

  if (typeof paraphrase_id !== "number" || paraphrase_id < 0 || !Number.isInteger(paraphrase_id)) {
    return NextResponse.json({ error: `Invalid paraphrase_id: ${paraphrase_id}` }, { status: 400 });
  }
  if (!MODALITIES.includes(modality as Modality)) {
    return NextResponse.json({ error: `Invalid modality: ${modality}` }, { status: 400 });
  }
  if (!patch || typeof patch !== "object") {
    return NextResponse.json({ error: "Missing patch object" }, { status: 400 });
  }

  try {
    const updated = updateVariant(entryId, paraphrase_id, modality as Modality, patch);
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
