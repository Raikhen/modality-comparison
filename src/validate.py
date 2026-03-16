#!/usr/bin/env python3
"""
Validate and summarize variant JSON files.

Usage:
    python3 -m src.validate validate     # Validate all JSONs in variants/
    python3 -m src.validate summary      # Print coverage summary
    python3 -m src.validate missing      # List entry IDs that still need variants
"""

import csv
import json
import sys
from pathlib import Path

from src.config import DATASET_PATH, VARIANTS_DIR
from src.schemas import MODALITIES, EntryVariants


def all_entry_ids() -> list[int]:
    with open(DATASET_PATH, newline="") as f:
        return [int(row["ID"]) for row in csv.DictReader(f)]


def generated_ids() -> set[int]:
    ids: set[int] = set()
    for path in VARIANTS_DIR.glob("*.json"):
        if path.name.startswith("_"):
            continue
        try:
            data = json.loads(path.read_text())
            ids.add(data["entry_id"])
        except Exception:
            pass
    return ids


def validate():
    files = sorted(VARIANTS_DIR.glob("*.json"))
    files = [f for f in files if not f.name.startswith("_")]

    if not files:
        print("No variant files found in variants/")
        return

    ok = 0
    errors = 0

    for path in files:
        try:
            data = json.loads(path.read_text())
            entry = EntryVariants(**data)
            n = len(entry.variants)
            num_p = entry.num_paraphrases

            expected_pairs = {
                (pid, m) for pid in range(num_p) for m in MODALITIES
            }
            actual_pairs = {(v.paraphrase_id, v.modality) for v in entry.variants}
            missing = expected_pairs - actual_pairs

            if missing:
                missing_str = ", ".join(
                    f"p{pid}/{m}" for pid, m in sorted(missing)
                )
                print(
                    f"  {path.name}: {n}/{len(expected_pairs)} variants, "
                    f"missing: {missing_str}"
                )
                errors += 1
            else:
                print(f"  {path.name}: {n} variants OK ({num_p} paraphrases)")
                ok += 1
        except Exception as e:
            print(f"  {path.name}: INVALID -- {e}")
            errors += 1

    print(f"\n{ok} valid, {errors} with issues")


def summary():
    ids = all_entry_ids()
    done = generated_ids()

    print(f"Dataset entries: {len(ids)}")
    print(f"Variants generated: {len(done)}")
    print(f"Remaining: {len(ids) - len(done)}")
    print(f"Coverage: {100 * len(done) / len(ids):.1f}%")


def missing():
    ids = all_entry_ids()
    done = generated_ids()
    remaining = [i for i in ids if i not in done]

    if not remaining:
        print("All entries have variant files!")
    else:
        print(f"{len(remaining)} entries still need variants:")
        for batch_start in range(0, len(remaining), 20):
            batch = remaining[batch_start : batch_start + 20]
            print(f"  {', '.join(str(i) for i in batch)}")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "validate"
    VARIANTS_DIR.mkdir(exist_ok=True)

    commands = {"validate": validate, "summary": summary, "missing": missing}
    if cmd in commands:
        commands[cmd]()
    else:
        print(f"Unknown command: {cmd}")
        print("Usage: python3 -m src.validate [validate|summary|missing]")
