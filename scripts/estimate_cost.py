#!/usr/bin/env python3
"""Estimate costs for generation, evaluation, and grading.

Usage:
    python3 scripts/estimate_cost.py --eval-model openai/gpt-4o \
        --grader-model anthropic/claude-sonnet-4-20250514 \
        --paraphrases 5 --rollouts 3

    python3 scripts/estimate_cost.py --eval-model openai/gpt-4o \
        --grader-model anthropic/claude-sonnet-4-20250514 \
        --paraphrases 5 --rollouts 3 --entries 10
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.config import DATASET_PATH, DEFAULT_PARAPHRASES, VARIANTS_DIR  # noqa: E402

# Pricing per 1M tokens (input, output) in USD
PRICING: dict[str, tuple[float, float]] = {
    "openai/gpt-4o": (2.50, 10.00),
    "openai/gpt-4o-mini": (0.15, 0.60),
    "anthropic/claude-sonnet-4-20250514": (3.00, 15.00),
    "anthropic/claude-opus-4-20250514": (15.00, 75.00),
    "google/gemini-2.5-flash": (0.15, 0.60),
    "google/gemini-3.1-flash-lite-preview": (0.00, 0.00),
}

# Default token estimates per call type
DEFAULT_TOKENS = {
    "paraphrase_gen": {"input": 800, "output": 1500},
    "scaffolding_gen": {"input": 3000, "output": 3000},
    "eval_plain_text": {"input": 500, "output": 800},
    "eval_with_history": {"input": 1200, "output": 800},
    "eval_agentic_no_history": {"input": 2000, "output": 800},
    "eval_agentic": {"input": 2500, "output": 1000},
    "grading": {"input": 2000, "output": 500},
}


def count_entries(entries_arg: int | None) -> int:
    try:
        with open(DATASET_PATH, newline="") as f:
            total = sum(1 for _ in csv.DictReader(f))
    except FileNotFoundError:
        total = 137  # fallback
    return min(entries_arg, total) if entries_arg else total


def estimate_from_variants(variants_dir: Path) -> dict[str, dict[str, int]] | None:
    """Try to estimate average token counts from existing variant files."""
    files = list(variants_dir.glob("*.json"))
    files = [f for f in files if not f.name.startswith("_")]
    if not files:
        return None

    totals: dict[str, dict[str, int]] = {}
    count = 0

    for path in files[:20]:  # sample up to 20
        try:
            data = json.loads(path.read_text())
            for v in data.get("variants", []):
                modality = v.get("modality", "plain_text")
                prompt_tokens = len(v.get("prompt", "").split()) * 2  # rough tokens
                sys_tokens = len((v.get("system_prompt") or "").split()) * 2
                history_tokens = sum(
                    len(m.get("content", "").split()) * 2
                    for m in (v.get("conversation_history") or [])
                )
                input_est = prompt_tokens + sys_tokens + history_tokens

                key = f"eval_{modality}"
                if key not in totals:
                    totals[key] = {"input": 0, "output": 0, "count": 0}
                totals[key]["input"] += input_est
                totals[key]["count"] += 1
            count += 1
        except Exception:
            continue

    if count == 0:
        return None

    result = {}
    for key, vals in totals.items():
        n = vals["count"]
        if n > 0:
            result[key] = {
                "input": vals["input"] // n,
                "output": DEFAULT_TOKENS.get(key, {}).get("output", 800),
            }
    return result


def format_cost(cost: float) -> str:
    if cost < 0.01:
        return f"${cost:.4f}"
    return f"${cost:.2f}"


def get_price(model: str) -> tuple[float, float]:
    if model in PRICING:
        return PRICING[model]
    # Try partial match
    for key, price in PRICING.items():
        if key.split("/")[-1] in model or model in key:
            return price
    return (5.0, 15.0)  # conservative default


def main():
    parser = argparse.ArgumentParser(description="Estimate experiment costs")
    parser.add_argument(
        "--gen-model", default="google/gemini-2.5-flash",
        help="Model used for variant generation",
    )
    parser.add_argument(
        "--eval-model", required=True,
        help="Model used for evaluation",
    )
    parser.add_argument(
        "--grader-model", required=True,
        help="Model used for grading",
    )
    parser.add_argument(
        "--paraphrases", type=int, default=DEFAULT_PARAPHRASES,
        help=f"Paraphrases per entry (default: {DEFAULT_PARAPHRASES})",
    )
    parser.add_argument(
        "--rollouts", type=int, default=1,
        help="Rollout epochs per sample (default: 1)",
    )
    parser.add_argument(
        "--entries", type=int, default=None,
        help="Number of entries (default: all in dataset)",
    )
    args = parser.parse_args()

    n_entries = count_entries(args.entries)
    n_para = args.paraphrases
    n_rollouts = args.rollouts
    n_modalities = 4

    gen_price = get_price(args.gen_model)
    eval_price = get_price(args.eval_model)
    grader_price = get_price(args.grader_model)

    # Try to get better estimates from existing variants
    token_estimates = estimate_from_variants(VARIANTS_DIR)
    tokens = {**DEFAULT_TOKENS}
    if token_estimates:
        tokens.update(token_estimates)

    print("=" * 60)
    print("COST ESTIMATE")
    print("=" * 60)
    print(f"\n  Entries:       {n_entries}")
    print(f"  Paraphrases:   {n_para}")
    print(f"  Modalities:    {n_modalities}")
    print(f"  Rollouts:      {n_rollouts}")
    print(f"  Total samples: {n_entries * n_para * n_modalities * n_rollouts}")

    print(f"\n  Gen model:     {args.gen_model}")
    print(f"  Eval model:    {args.eval_model}")
    print(f"  Grader model:  {args.grader_model}")

    # --- Generation costs ---
    # 1 paraphrase call + N scaffolding calls per entry
    para_calls = n_entries  # 1 call generates N-1 paraphrases
    scaffolding_calls = n_entries * n_para
    total_gen_calls = para_calls + scaffolding_calls

    gen_input_tokens = (
        para_calls * tokens["paraphrase_gen"]["input"]
        + scaffolding_calls * tokens["scaffolding_gen"]["input"]
    )
    gen_output_tokens = (
        para_calls * tokens["paraphrase_gen"]["output"]
        + scaffolding_calls * tokens["scaffolding_gen"]["output"]
    )
    gen_cost = (
        gen_input_tokens * gen_price[0] / 1_000_000
        + gen_output_tokens * gen_price[1] / 1_000_000
    )

    # --- Eval costs ---
    samples_per_modality = n_entries * n_para * n_rollouts
    eval_input_tokens = 0
    eval_output_tokens = 0
    for mod in ["plain_text", "with_history", "agentic_no_history", "agentic"]:
        key = f"eval_{mod}"
        t = tokens.get(key, {"input": 1500, "output": 800})
        eval_input_tokens += samples_per_modality * t["input"]
        eval_output_tokens += samples_per_modality * t["output"]

    eval_cost = (
        eval_input_tokens * eval_price[0] / 1_000_000
        + eval_output_tokens * eval_price[1] / 1_000_000
    )

    # --- Grading costs ---
    total_grading_samples = n_entries * n_para * n_modalities * n_rollouts
    grading_input_tokens = total_grading_samples * tokens["grading"]["input"]
    grading_output_tokens = total_grading_samples * tokens["grading"]["output"]
    grading_cost = (
        grading_input_tokens * grader_price[0] / 1_000_000
        + grading_output_tokens * grader_price[1] / 1_000_000
    )

    total_cost = gen_cost + eval_cost + grading_cost

    print(f"\n{'Component':<25} {'Calls':>8} {'Input tok':>12} {'Output tok':>12} {'Cost':>10}")
    print("-" * 70)
    print(f"{'Generation':<25} {total_gen_calls:>8} {gen_input_tokens:>12,} {gen_output_tokens:>12,} {format_cost(gen_cost):>10}")
    print(f"{'Evaluation':<25} {total_grading_samples:>8} {eval_input_tokens:>12,} {eval_output_tokens:>12,} {format_cost(eval_cost):>10}")
    print(f"{'Grading':<25} {total_grading_samples:>8} {grading_input_tokens:>12,} {grading_output_tokens:>12,} {format_cost(grading_cost):>10}")
    print("-" * 70)
    print(f"{'TOTAL':<25} {'':>8} {'':>12} {'':>12} {format_cost(total_cost):>10}")

    if token_estimates:
        print("\n  (Token estimates refined from existing variant files)")
    else:
        print("\n  (Using default token estimates — generate variants first for better accuracy)")


if __name__ == "__main__":
    main()
