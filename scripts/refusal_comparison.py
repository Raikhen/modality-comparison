#!/usr/bin/env python3
"""Compare refusal rates between models on scaffolding generation.

Sends the scaffolding prompt (with full adversarial prompt) to multiple models
and saves results incrementally — one file per (entry, model) pair. Valid
scaffolding is assembled into viewer-compatible variant files saved to the
model's source directory under data/variants/.

Architecture:
  - Each API result is saved to data/refusal_comparison/raw/{model}/{id}.json
    immediately on completion (crash-safe, resumable).
  - Valid scaffolding is assembled into variant structures and written to
    data/variants/{model}/{id}.json for the viewer.
  - A run manifest tracks planned entries and completion status.

Usage:
    python3 scripts/refusal_comparison.py
    python3 scripts/refusal_comparison.py --seed 42 --count 20
    python3 scripts/refusal_comparison.py --resume       # resume incomplete run
    python3 scripts/refusal_comparison.py --assemble     # re-assemble viewer files from raw

Requires OPENROUTER_API_KEY in environment (or .env file).
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import json
import logging
import os
import random
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from openai import AsyncOpenAI

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.config import DATASET_PATH, VARIANTS_DIR  # noqa: E402
from src.schemas import MODALITIES  # noqa: E402
from scripts.generate_variants import scaffolding_prompt, SAFETY_SETTINGS  # noqa: E402

MODELS = {
    "gemini": "google/gemini-2.5-flash",
    "deepseek": "deepseek/deepseek-v3.2",
}

GENERATION_METHOD = "scaffolding_v2__full_adversarial_prompt"

RAW_DIR = PROJECT_ROOT / "data" / "refusal_comparison" / "raw"
MANIFEST_DIR = PROJECT_ROOT / "data" / "refusal_comparison"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("refusal_comparison")


# ---------------------------------------------------------------------------
# Dataset
# ---------------------------------------------------------------------------


def load_entries() -> list[dict]:
    with open(DATASET_PATH, newline="") as f:
        return list(csv.DictReader(f))


# ---------------------------------------------------------------------------
# Persistence — per-entry raw results
# ---------------------------------------------------------------------------


def _raw_path(model_key: str, entry_id: int) -> Path:
    return RAW_DIR / model_key / f"{entry_id}.json"


def _save_raw(model_key: str, entry_id: int, data: dict):
    path = _raw_path(model_key, entry_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False))


def _load_raw(model_key: str, entry_id: int) -> dict | None:
    path = _raw_path(model_key, entry_id)
    if path.exists():
        try:
            return json.loads(path.read_text())
        except Exception:
            return None
    return None


def _completed_ids(model_key: str) -> set[int]:
    """Return entry IDs that already have a raw result for this model."""
    model_dir = RAW_DIR / model_key
    if not model_dir.exists():
        return set()
    ids = set()
    for path in model_dir.glob("*.json"):
        try:
            data = json.loads(path.read_text())
            if data.get("raw_response") is not None:
                ids.add(data["entry_id"])
        except Exception:
            pass
    return ids


# ---------------------------------------------------------------------------
# Manifest — tracks planned runs
# ---------------------------------------------------------------------------


def _save_manifest(seed: int, entry_ids: list[int], models: dict[str, str]):
    MANIFEST_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {
        "seed": seed,
        "entry_ids": entry_ids,
        "models": models,
        "generation_method": GENERATION_METHOD,
        "created": datetime.now(timezone.utc).isoformat(),
    }
    path = MANIFEST_DIR / "manifest.json"
    path.write_text(json.dumps(manifest, indent=2))
    return path


def _load_manifest() -> dict | None:
    path = MANIFEST_DIR / "manifest.json"
    if path.exists():
        try:
            return json.loads(path.read_text())
        except Exception:
            return None
    return None


# ---------------------------------------------------------------------------
# API client
# ---------------------------------------------------------------------------


def _make_client() -> AsyncOpenAI:
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        env_path = PROJECT_ROOT / ".env"
        if env_path.exists():
            for line in env_path.read_text().splitlines():
                if line.startswith("OPENROUTER_API_KEY="):
                    api_key = line.split("=", 1)[1].strip().strip("\"'")
                    break
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY not found in environment or .env file")
    return AsyncOpenAI(base_url="https://openrouter.ai/api/v1", api_key=api_key)


# ---------------------------------------------------------------------------
# API call — single (entry, model) pair
# ---------------------------------------------------------------------------


async def call_and_save(
    client: AsyncOpenAI,
    model_key: str,
    model_id: str,
    entry: dict,
    semaphore: asyncio.Semaphore,
) -> dict:
    """Call one model for one entry, save raw result immediately, return it."""
    entry_id = int(entry["ID"])

    async with semaphore:
        system, user = scaffolding_prompt(entry)
        start = time.time()

        extra_body: dict = {}
        if model_key == "gemini":
            extra_body = {
                "provider": {"order": ["Google"], "allow_fallbacks": False},
                "safety_settings": SAFETY_SETTINGS,
            }

        result = {
            "entry_id": entry_id,
            "risk_domain": entry["risk_domain"],
            "risk_subdomain": entry["risk_subdomain"],
            "model_key": model_key,
            "model_id": model_id,
            "generation_method": GENERATION_METHOD,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        try:
            response = await client.chat.completions.create(
                model=model_id,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                temperature=0.7,
                max_tokens=8192,
                extra_body=extra_body,
                **({"response_format": {"type": "json_object"}} if model_key == "gemini" else {}),
            )
            raw = response.choices[0].message.content.strip()

            # Strip markdown fences if present
            if raw.startswith("```"):
                lines = raw.split("\n")
                if lines[-1].strip() == "```":
                    lines = lines[1:-1]
                else:
                    lines = lines[1:]
                raw = "\n".join(lines)

            result["raw_response"] = raw
            result["elapsed_seconds"] = round(time.time() - start, 2)
            result["error"] = None

            try:
                parsed = json.loads(raw)
                result["valid_json"] = True
                result["has_required_keys"] = all(
                    k in parsed
                    for k in ["system_prompt", "tools", "files", "tool_responses", "conversation_history"]
                )
            except json.JSONDecodeError:
                result["valid_json"] = False
                result["has_required_keys"] = False

        except Exception as e:
            result["raw_response"] = None
            result["elapsed_seconds"] = round(time.time() - start, 2)
            result["error"] = str(e)
            result["valid_json"] = False
            result["has_required_keys"] = False

        # Save immediately — this is the key architectural change
        _save_raw(model_key, entry_id, result)

        status = "OK" if result.get("valid_json") else ("ERROR" if result.get("error") else "REFUSED/INVALID")
        log.info(f"entry {entry_id:>4d} | {model_key:<10s} | {status} | {result['elapsed_seconds']:.1f}s")

        return result


# ---------------------------------------------------------------------------
# Assembly — convert raw scaffolding into viewer-compatible variant files
# ---------------------------------------------------------------------------


def assemble_variant_file(entry: dict, model_key: str, raw: dict) -> dict | None:
    """Assemble a raw scaffolding result into a variant structure for the viewer.

    Since we only ran scaffolding (no paraphrases), this produces
    num_paraphrases=1 with paraphrase_id=0 across 4 modalities.
    """
    if not raw.get("valid_json") or not raw.get("has_required_keys"):
        return None

    try:
        scaffolding = json.loads(raw["raw_response"])
    except (json.JSONDecodeError, TypeError):
        return None

    entry_id = int(entry["ID"])
    original_prompt = entry["adversarial_prompt"]

    # Normalize conversation_history to a flat list
    conv_history = scaffolding.get("conversation_history", [])
    if isinstance(conv_history, dict):
        conv_history = conv_history.get("verbatim") or next(iter(conv_history.values()), [])

    sys_prompt = scaffolding["system_prompt"]
    tools = scaffolding["tools"]
    files = scaffolding["files"]
    tool_responses = scaffolding.get("tool_responses")

    variants = []
    for modality in MODALITIES:
        v: dict = {
            "paraphrase_id": 0,
            "modality": modality,
            "prompt": original_prompt,
        }

        if modality == "plain_text":
            pass
        elif modality == "plain_text_with_history":
            v["conversation_history"] = conv_history
        elif modality == "agentic_no_history":
            v["system_prompt"] = sys_prompt
            v["tools"] = tools
            v["files"] = files
            if tool_responses:
                v["tool_responses"] = tool_responses
        elif modality == "agentic":
            v["system_prompt"] = sys_prompt
            v["tools"] = tools
            v["files"] = files
            if tool_responses:
                v["tool_responses"] = tool_responses
            v["conversation_history"] = conv_history

        variants.append(v)

    return {
        "entry_id": entry_id,
        "original_prompt": original_prompt,
        "risk_domain": entry["risk_domain"],
        "num_paraphrases": 1,
        "generated_by": {
            "scaffolding": raw["model_id"],
            "generation_method": GENERATION_METHOD,
            "note": "Scaffolding-only (no paraphrases). Single paraphrase_id=0 with original prompt.",
        },
        "variants": variants,
    }


def save_variant_file(model_key: str, variant_data: dict):
    """Save an assembled variant file to the model's viewer source directory."""
    out_dir = VARIANTS_DIR.parent / model_key
    out_dir.mkdir(parents=True, exist_ok=True)
    entry_id = variant_data["entry_id"]
    path = out_dir / f"{entry_id}.json"
    path.write_text(json.dumps(variant_data, indent=2, ensure_ascii=False))
    return path


def assemble_all():
    """Re-assemble viewer files from all raw results."""
    entries_by_id = {int(e["ID"]): e for e in load_entries()}
    assembled = 0
    skipped = 0

    for model_key in MODELS:
        model_dir = RAW_DIR / model_key
        if not model_dir.exists():
            continue
        for path in sorted(model_dir.glob("*.json")):
            try:
                raw = json.loads(path.read_text())
                entry_id = raw["entry_id"]
                entry = entries_by_id.get(entry_id)
                if not entry:
                    continue

                variant_data = assemble_variant_file(entry, model_key, raw)
                if variant_data:
                    save_variant_file(model_key, variant_data)
                    assembled += 1
                else:
                    skipped += 1
            except Exception as e:
                log.warning(f"Failed to assemble {path.name} for {model_key}: {e}")
                skipped += 1

    log.info(f"Assembly complete: {assembled} assembled, {skipped} skipped")


# ---------------------------------------------------------------------------
# Main run
# ---------------------------------------------------------------------------


async def run(args: argparse.Namespace):
    if args.assemble:
        assemble_all()
        return

    entries = load_entries()
    entries_by_id = {int(e["ID"]): e for e in entries}

    # Resume from manifest or start fresh
    if args.resume:
        manifest = _load_manifest()
        if not manifest:
            log.error("No manifest found to resume. Run without --resume first.")
            return
        target_ids = manifest["entry_ids"]
        sample = [entries_by_id[eid] for eid in target_ids if eid in entries_by_id]
        log.info(f"Resuming run (seed={manifest['seed']}, {len(sample)} entries)")
    else:
        rng = random.Random(args.seed)
        sample = rng.sample(entries, min(args.count, len(entries)))
        target_ids = [int(e["ID"]) for e in sample]
        _save_manifest(args.seed, target_ids, MODELS)

    log.info(f"Entries: {', '.join(str(int(e['ID'])) for e in sample)}")

    # Figure out what still needs to be done
    tasks = []
    client = _make_client()
    semaphore = asyncio.Semaphore(args.max_parallel)

    for entry in sample:
        entry_id = int(entry["ID"])
        for model_key, model_id in MODELS.items():
            existing = _load_raw(model_key, entry_id)
            if existing and existing.get("raw_response") is not None:
                log.info(f"entry {entry_id:>4d} | {model_key:<10s} | cached")
                continue
            tasks.append(call_and_save(client, model_key, model_id, entry, semaphore))

    if not tasks:
        log.info("All entries already complete. Use --assemble to rebuild viewer files.")
    else:
        log.info(f"Sending {len(tasks)} API calls ({len(tasks)} remaining)...")
        start = time.time()
        await asyncio.gather(*tasks, return_exceptions=True)
        log.info(f"API calls complete in {time.time() - start:.0f}s")

    # Assemble viewer files from all raw results
    log.info("Assembling viewer-compatible variant files...")
    for entry in sample:
        entry_id = int(entry["ID"])
        for model_key in MODELS:
            raw = _load_raw(model_key, entry_id)
            if not raw:
                continue
            variant_data = assemble_variant_file(entry, model_key, raw)
            if variant_data:
                path = save_variant_file(model_key, variant_data)
                log.info(f"  wrote {path.relative_to(PROJECT_ROOT)}")

    # Print summary
    log.info("")
    log.info("=== Summary ===")
    for model_key in MODELS:
        total = 0
        valid = 0
        errors = 0
        refused = 0
        for entry in sample:
            raw = _load_raw(model_key, int(entry["ID"]))
            if not raw:
                continue
            total += 1
            if raw.get("valid_json") and raw.get("has_required_keys"):
                valid += 1
            elif raw.get("error"):
                errors += 1
            else:
                refused += 1
        log.info(f"  {model_key}: {valid}/{total} valid, {errors} errors, {refused} refused/invalid")


def main():
    parser = argparse.ArgumentParser(description="Compare refusal rates between models")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for entry selection")
    parser.add_argument("--count", type=int, default=20, help="Number of entries to test")
    parser.add_argument("--max-parallel", type=int, default=5, help="Max concurrent API calls")
    parser.add_argument("--resume", action="store_true", help="Resume from previous manifest")
    parser.add_argument("--assemble", action="store_true", help="Re-assemble viewer files from raw results (no API calls)")
    args = parser.parse_args()
    asyncio.run(run(args))


if __name__ == "__main__":
    main()
