#!/usr/bin/env python3
"""Estimate costs for generation, evaluation, and grading.

Usage:
    # Single model:
    python3 scripts/estimate_cost.py --eval-model openai/gpt-5.4 \
        --grader-model anthropic/claude-sonnet-4.6 \
        --paraphrases 5 --rollouts 3

    # All configured eval models:
    python3 scripts/estimate_cost.py --all-models \
        --grader-model anthropic/claude-sonnet-4.6 \
        --paraphrases 5 --rollouts 3

    # Subset of entries:
    python3 scripts/estimate_cost.py --all-models \
        --grader-model anthropic/claude-sonnet-4.6 \
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

from src.config import (  # noqa: E402
    DATASET_PATH,
    DEFAULT_GRADER,
    DEFAULT_PARAPHRASES,
    EVAL_MODELS,
    VARIANTS_DIR,
)

# Pricing per 1M tokens (input, output) in USD — OpenRouter rates (March 2026)
PRICING: dict[str, tuple[float, float]] = {
    # Frontier closed-source (retained for grader use)
    "openai/gpt-5.4": (2.50, 15.00),
    "anthropic/claude-sonnet-4.6": (3.00, 15.00),
    # Efficient closed-source
    "openai/gpt-5-mini": (0.25, 2.00),
    "anthropic/claude-haiku-4.5": (1.00, 5.00),
    "google/gemini-3.1-flash-lite-preview": (0.25, 1.50),
    # Open-source (hosted via OpenRouter)
    "meta-llama/llama-4-maverick": (0.15, 0.60),
    "deepseek/deepseek-v3.2": (0.26, 0.38),
    # Reasoning
    "deepseek/deepseek-r1": (0.70, 2.50),
    # Generation model
    "google/gemini-2.5-flash": (0.15, 0.60),
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
        total = 500  # fallback
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


def estimate_single_model(
    eval_model: str,
    grader_model: str,
    gen_model: str,
    n_entries: int,
    n_para: int,
    n_rollouts: int,
    tokens: dict,
) -> dict:
    """Compute cost breakdown for a single eval model. Returns a dict of costs."""
    n_modalities = 4
    eval_price = get_price(eval_model)
    grader_price = get_price(grader_model)

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

    total_grading_samples = n_entries * n_para * n_modalities * n_rollouts
    grading_input_tokens = total_grading_samples * tokens["grading"]["input"]
    grading_output_tokens = total_grading_samples * tokens["grading"]["output"]
    grading_cost = (
        grading_input_tokens * grader_price[0] / 1_000_000
        + grading_output_tokens * grader_price[1] / 1_000_000
    )

    return {
        "eval_model": eval_model,
        "grader_model": grader_model,
        "total_samples": total_grading_samples,
        "eval_input_tokens": eval_input_tokens,
        "eval_output_tokens": eval_output_tokens,
        "eval_cost": eval_cost,
        "grading_input_tokens": grading_input_tokens,
        "grading_output_tokens": grading_output_tokens,
        "grading_cost": grading_cost,
        "total_cost": eval_cost + grading_cost,
    }


def resolve_grader(eval_model: str, grader_model: str) -> str:
    """Ensure the grader differs from the eval model.

    If they match, swap to a default alternative.
    """
    if eval_model == grader_model:
        # Swap to GPT-5-mini for Anthropic eval models, Claude Haiku otherwise
        if "anthropic" in eval_model:
            return "openai/gpt-5-mini"
        return DEFAULT_GRADER
    return grader_model


def main():
    parser = argparse.ArgumentParser(description="Estimate experiment costs")
    parser.add_argument(
        "--gen-model", default="google/gemini-2.5-flash",
        help="Model used for variant generation",
    )
    parser.add_argument(
        "--eval-model", action="append", dest="eval_models", default=None,
        help="Model(s) to evaluate (repeatable). Ignored if --all-models is set.",
    )
    parser.add_argument(
        "--all-models", action="store_true",
        help=f"Estimate costs for all {len(EVAL_MODELS)} configured eval models",
    )
    parser.add_argument(
        "--grader-model", default=DEFAULT_GRADER,
        help=f"Model used for grading (default: {DEFAULT_GRADER})",
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

    # Resolve which eval models to estimate
    if args.all_models:
        eval_models = list(EVAL_MODELS)
    elif args.eval_models:
        eval_models = args.eval_models
    else:
        parser.error("Provide --eval-model <model> or --all-models")

    n_entries = count_entries(args.entries)
    n_para = args.paraphrases
    n_rollouts = args.rollouts
    n_modalities = 4

    # Try to get better estimates from existing variants
    token_estimates = estimate_from_variants(VARIANTS_DIR)
    tokens = {**DEFAULT_TOKENS}
    if token_estimates:
        tokens.update(token_estimates)

    # --- Generation costs (one-time, model-independent) ---
    gen_price = get_price(args.gen_model)
    para_calls = n_entries
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

    # --- Per-model eval + grading costs ---
    model_results = []
    for eval_model in eval_models:
        grader = resolve_grader(eval_model, args.grader_model)
        result = estimate_single_model(
            eval_model=eval_model,
            grader_model=grader,
            gen_model=args.gen_model,
            n_entries=n_entries,
            n_para=n_para,
            n_rollouts=n_rollouts,
            tokens=tokens,
        )
        model_results.append(result)

    # --- Output ---
    print("=" * 70)
    print("COST ESTIMATE")
    print("=" * 70)
    print(f"\n  Entries:         {n_entries}")
    print(f"  Paraphrases:     {n_para}")
    print(f"  Modalities:      {n_modalities}")
    print(f"  Rollouts:        {n_rollouts}")
    samples_per_model = n_entries * n_para * n_modalities * n_rollouts
    print(f"  Samples/model:   {samples_per_model:,}")
    print(f"  Eval models:     {len(eval_models)}")
    print(f"  Total samples:   {samples_per_model * len(eval_models):,}")

    # Generation (one-time)
    print(f"\n{'─' * 70}")
    print("GENERATION (one-time)")
    print(f"{'─' * 70}")
    print(f"  Model:           {args.gen_model}")
    print(f"  Calls:           {total_gen_calls:,}")
    print(f"  Input tokens:    {gen_input_tokens:,}")
    print(f"  Output tokens:   {gen_output_tokens:,}")
    print(f"  Cost:            {format_cost(gen_cost)}")

    # Per-model breakdown
    print(f"\n{'─' * 70}")
    print("EVALUATION + GRADING (per model)")
    print(f"{'─' * 70}")

    header = f"  {'Eval model':<38} {'Grader':<20} {'Eval':>8} {'Grade':>8} {'Total':>8}"
    print(header)
    print(f"  {'─' * 66}")

    total_eval_cost = 0.0
    for r in model_results:
        grader_short = r["grader_model"].split("/")[-1][:18]
        print(
            f"  {r['eval_model']:<38} {grader_short:<20} "
            f"{format_cost(r['eval_cost']):>8} "
            f"{format_cost(r['grading_cost']):>8} "
            f"{format_cost(r['total_cost']):>8}"
        )
        total_eval_cost += r["total_cost"]

    # Grand total
    grand_total = gen_cost + total_eval_cost
    print(f"\n{'─' * 70}")
    print("TOTALS")
    print(f"{'─' * 70}")
    print(f"  Generation:      {format_cost(gen_cost)}")
    print(f"  All eval+grade:  {format_cost(total_eval_cost)}")
    print(f"  Grand total:     {format_cost(grand_total)}")

    if len(eval_models) > 1:
        cheapest = min(model_results, key=lambda r: r["total_cost"])
        costliest = max(model_results, key=lambda r: r["total_cost"])
        print(f"\n  Cheapest model:  {cheapest['eval_model']} ({format_cost(cheapest['total_cost'])})")
        print(f"  Costliest model: {costliest['eval_model']} ({format_cost(costliest['total_cost'])})")

    # Self-grading warnings
    for r in model_results:
        if r["eval_model"] == r["grader_model"]:
            print(f"\n  WARNING: {r['eval_model']} uses itself as grader — will fail at runtime")

    if token_estimates:
        print("\n  (Token estimates refined from existing variant files)")
    else:
        print("\n  (Using default token estimates — generate variants first for better accuracy)")


if __name__ == "__main__":
    main()
