#!/usr/bin/env python3
"""Repair common issues in generated variant files.

Fixes:
  1. Wrong tone labels: rephrase_1 → formal, rephrase_2 → casual
  2. Inconsistent agentic context across tones: copies verbatim tone's
     system_prompt, tools, files, and tool_responses to all other tones
     within the same modality
  3. Removes unparseable JSON files so they get re-queued

Usage:
    python3 scripts/repair_variants.py          # dry-run (report only)
    python3 scripts/repair_variants.py --fix    # apply fixes
"""

import json
import sys
from pathlib import Path

VARIANTS_DIR = Path(__file__).resolve().parent.parent / "variants"

TONE_MAP = {"rephrase_1": "formal", "rephrase_2": "casual"}
AGENTIC_FIELDS = ("system_prompt", "tools", "files", "tool_responses")


def diagnose(data: dict) -> list[str]:
    """Return list of issues found in a parsed variant file."""
    issues = []
    tones = {v["tone"] for v in data["variants"]}
    bad_tones = tones - {"verbatim", "formal", "casual"}
    if bad_tones:
        issues.append(f"wrong tones: {sorted(bad_tones)}")

    # Check cross-tone consistency of agentic fields per modality
    by_modality: dict[str, list[dict]] = {}
    for v in data["variants"]:
        by_modality.setdefault(v["modality"], []).append(v)

    for modality, variants in by_modality.items():
        for field in AGENTIC_FIELDS:
            values = [json.dumps(v.get(field), sort_keys=True) for v in variants]
            if len(set(values)) > 1:
                issues.append(f"{modality}: {field} differs across tones")
                break  # one report per modality is enough

    return issues


def repair(data: dict) -> dict:
    """Apply fixes in-place and return the data."""
    # Fix 1: rename tones
    for v in data["variants"]:
        if v["tone"] in TONE_MAP:
            v["tone"] = TONE_MAP[v["tone"]]

    # Fix 2: normalize agentic context — use verbatim as source of truth
    by_modality: dict[str, list[dict]] = {}
    for v in data["variants"]:
        by_modality.setdefault(v["modality"], []).append(v)

    for modality, variants in by_modality.items():
        # Find the verbatim variant as the canonical source
        verbatim = next((v for v in variants if v["tone"] == "verbatim"), None)
        if not verbatim:
            continue

        for v in variants:
            if v["tone"] == "verbatim":
                continue
            for field in AGENTIC_FIELDS:
                if field in verbatim and verbatim[field] is not None:
                    v[field] = verbatim[field]
                elif field in v:
                    # verbatim doesn't have it, remove from others too
                    v.pop(field, None)

    return data


def main():
    fix = "--fix" in sys.argv
    files = sorted(VARIANTS_DIR.glob("*.json"))
    files = [f for f in files if not f.name.startswith("_")]

    stats = {"ok": 0, "fixed": 0, "unparseable": 0}

    for path in files:
        try:
            data = json.loads(path.read_text())
        except Exception as e:
            print(f"  {path.name}: UNPARSEABLE — {e}")
            if fix:
                path.unlink()
                print(f"    → deleted (will be re-queued)")
            stats["unparseable"] += 1
            continue

        issues = diagnose(data)
        if not issues:
            stats["ok"] += 1
            continue

        print(f"  {path.name}: {'; '.join(issues)}")
        if fix:
            data = repair(data)
            remaining = diagnose(data)
            if remaining:
                print(f"    → still has issues after repair: {remaining}")
            else:
                path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
                print(f"    → fixed")
                stats["fixed"] += 1
        else:
            stats["fixed"] += 1  # would-be fixed

    print()
    if fix:
        print(f"Done: {stats['ok']} already ok, {stats['fixed']} fixed, {stats['unparseable']} deleted")
    else:
        print(f"Dry run: {stats['ok']} ok, {stats['fixed']} fixable, {stats['unparseable']} unparseable")
        if stats["fixed"] or stats["unparseable"]:
            print("Run with --fix to apply repairs.")


if __name__ == "__main__":
    main()
