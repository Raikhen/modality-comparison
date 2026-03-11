#!/usr/bin/env python3
"""
Analyze evaluation results from Inspect logs.

Reads an Inspect .eval log (ZIP archive) and produces a 2×K factorial
analysis of compliance scores across modality and tone dimensions.

Usage:
    python3 -m src.analyze                                      # analyze latest log
    python3 -m src.analyze logs/2026-03-11_modality-eval.eval   # analyze specific log
"""

import json
import sys
import zipfile
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from src.config import FIGURES_DIR, LOGS_DIR
from src.schemas import MODALITIES, TONES

PALETTE = {"plain_text": "#4C72B0", "agentic": "#DD8452"}


def load_eval_log(log_path: Path) -> list[dict]:
    """Extract scored samples from an Inspect .eval ZIP log."""
    rows: list[dict] = []

    with zipfile.ZipFile(log_path) as z:
        sample_files = [n for n in z.namelist() if n.startswith("samples/")]
        for name in sample_files:
            sample = json.loads(z.read(name))
            scores = sample.get("scores", {})
            scorer_key = next(iter(scores), None)
            if not scorer_key:
                continue

            score_info = scores[scorer_key]
            value = score_info.get("value")
            metadata = sample.get("metadata", {})

            rows.append(
                {
                    "entry_id": metadata.get("entry_id"),
                    "tone": metadata.get("tone"),
                    "modality": metadata.get("modality"),
                    "risk_domain": metadata.get("risk_domain"),
                    "compliance_score": value
                    if isinstance(value, (int, float))
                    else -1,
                    "sample_id": sample.get("id", ""),
                }
            )

    return rows


def find_latest_log() -> Path:
    if not LOGS_DIR.exists():
        raise FileNotFoundError("No logs/ directory found. Run an eval first.")

    log_files = sorted(LOGS_DIR.glob("*.eval"), key=lambda p: p.stat().st_mtime)
    if not log_files:
        raise FileNotFoundError("No .eval log files found in logs/.")
    return log_files[-1]


def _ci_95(series: pd.Series) -> float:
    """95% confidence interval half-width (CLT-based)."""
    n = len(series)
    if n < 2:
        return 0.0
    return 1.96 * series.std() / np.sqrt(n)


def analyze(df: pd.DataFrame) -> None:
    df = df[df["compliance_score"] >= 0].copy()

    print("=" * 70)
    print("MODALITY x TONE FACTORIAL ANALYSIS")
    print("=" * 70)

    print("\n1. MAIN EFFECT OF MODALITY")
    print("-" * 40)
    modality_stats = df.groupby("modality")["compliance_score"].agg(
        ["mean", "std", "count"]
    )
    print(modality_stats.to_string())

    plain = df[df["modality"] == "plain_text"]["compliance_score"]
    agentic = df[df["modality"] == "agentic"]["compliance_score"]
    if len(plain) > 0 and len(agentic) > 0:
        delta = agentic.mean() - plain.mean()
        print(f"\nDelta (agentic - plain_text): {delta:+.3f}")

    print("\n2. MAIN EFFECT OF TONE")
    print("-" * 40)
    tone_stats = df.groupby("tone")["compliance_score"].agg(["mean", "std", "count"])
    print(tone_stats.to_string())

    print("\n3. INTERACTION: MODALITY x TONE")
    print("-" * 40)
    cross = df.pivot_table(
        values="compliance_score",
        index="tone",
        columns="modality",
        aggfunc=["mean", "count"],
    )
    print(cross.to_string())

    print("\n4. BY RISK DOMAIN")
    print("-" * 40)
    domain_stats = df.pivot_table(
        values="compliance_score",
        index="risk_domain",
        columns="modality",
        aggfunc="mean",
    )
    print(domain_stats.to_string())

    print("\n5. PER-ENTRY COMPLIANCE SCORES")
    print("-" * 40)
    entry_view = df.pivot_table(
        values="compliance_score",
        index="entry_id",
        columns=["modality", "tone"],
        aggfunc="mean",
    )
    print(entry_view.to_string())

    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    total = len(df)
    refusals = len(df[df["compliance_score"] == 0])
    print(f"Total scored samples: {total}")
    print(f"Full refusals (score=0): {refusals} ({100 * refusals / total:.1f}%)")
    print(f"Mean compliance: {df['compliance_score'].mean():.3f}")

    if len(plain) > 0 and len(agentic) > 0:
        plain_refusal = (plain == 0).mean()
        agentic_refusal = (agentic == 0).mean()
        print(f"\nRefusal rate -- plain_text: {100 * plain_refusal:.1f}%")
        print(f"Refusal rate -- agentic:    {100 * agentic_refusal:.1f}%")
        print(
            f"Refusal rate delta:         {100 * (agentic_refusal - plain_refusal):+.1f}pp"
        )


def plot(df: pd.DataFrame, output_dir: Path) -> None:
    df = df[df["compliance_score"] >= 0].copy()
    output_dir.mkdir(exist_ok=True)

    bar_width = 0.35
    x = np.arange(len(TONES))

    # --- Figure 1: Modality × Tone interaction ---
    fig, ax = plt.subplots(figsize=(8, 5))
    for i, modality in enumerate(MODALITIES):
        subset = df[df["modality"] == modality]
        means = [subset[subset["tone"] == t]["compliance_score"].mean() for t in TONES]
        cis = [_ci_95(subset[subset["tone"] == t]["compliance_score"]) for t in TONES]
        offset = (i - 0.5) * bar_width
        ax.bar(
            x + offset,
            means,
            bar_width,
            yerr=cis,
            capsize=4,
            label=modality,
            color=PALETTE[modality],
            alpha=0.85,
        )
    ax.set_xticks(x)
    ax.set_xticklabels(TONES)
    ax.set_ylabel("Mean Compliance Score (0-7)")
    ax.set_xlabel("Tone")
    ax.set_title("Compliance by Modality × Tone")
    ax.legend(title="Modality")
    ax.set_ylim(bottom=0)
    fig.tight_layout()
    fig.savefig(output_dir / "modality_x_tone.png", dpi=150)
    print(f"  Saved {output_dir / 'modality_x_tone.png'}")
    plt.close(fig)

    # --- Figure 2: Modality main effect ---
    fig, ax = plt.subplots(figsize=(5, 5))
    stats = []
    for modality in MODALITIES:
        s = df[df["modality"] == modality]["compliance_score"]
        stats.append({"modality": modality, "mean": s.mean(), "ci": _ci_95(s)})
    stats_df = pd.DataFrame(stats)
    ax.bar(
        stats_df["modality"],
        stats_df["mean"],
        yerr=stats_df["ci"],
        capsize=5,
        color=[PALETTE[m] for m in stats_df["modality"]],
        alpha=0.85,
    )
    ax.set_ylabel("Mean Compliance Score (0-7)")
    ax.set_title("Main Effect of Modality")
    ax.set_ylim(bottom=0)
    fig.tight_layout()
    fig.savefig(output_dir / "modality_main_effect.png", dpi=150)
    print(f"  Saved {output_dir / 'modality_main_effect.png'}")
    plt.close(fig)

    # --- Figure 3: Refusal rate by modality × tone ---
    fig, ax = plt.subplots(figsize=(8, 5))
    for i, modality in enumerate(MODALITIES):
        subset = df[df["modality"] == modality]
        refusal_rates = []
        cis = []
        for t in TONES:
            scores = subset[subset["tone"] == t]["compliance_score"]
            is_refusal = (scores == 0).astype(float)
            refusal_rates.append(is_refusal.mean() * 100)
            cis.append(_ci_95(is_refusal) * 100)
        offset = (i - 0.5) * bar_width
        ax.bar(
            x + offset,
            refusal_rates,
            bar_width,
            yerr=cis,
            capsize=4,
            label=modality,
            color=PALETTE[modality],
            alpha=0.85,
        )
    ax.set_xticks(x)
    ax.set_xticklabels(TONES)
    ax.set_ylabel("Refusal Rate (%)")
    ax.set_xlabel("Tone")
    ax.set_title("Refusal Rate by Modality × Tone")
    ax.legend(title="Modality")
    ax.set_ylim(bottom=0)
    fig.tight_layout()
    fig.savefig(output_dir / "refusal_rate.png", dpi=150)
    print(f"  Saved {output_dir / 'refusal_rate.png'}")
    plt.close(fig)

    # --- Figure 4: By risk domain ---
    domains = sorted(df["risk_domain"].unique())
    if len(domains) > 1:
        fig, ax = plt.subplots(figsize=(10, 5))
        y = np.arange(len(domains))
        bar_height = 0.35
        for i, modality in enumerate(MODALITIES):
            subset = df[df["modality"] == modality]
            means = [
                subset[subset["risk_domain"] == d]["compliance_score"].mean()
                for d in domains
            ]
            cis = [
                _ci_95(subset[subset["risk_domain"] == d]["compliance_score"])
                for d in domains
            ]
            offset = (i - 0.5) * bar_height
            ax.barh(
                y + offset,
                means,
                bar_height,
                xerr=cis,
                capsize=3,
                label=modality,
                color=PALETTE[modality],
                alpha=0.85,
            )
        ax.set_yticks(y)
        ax.set_yticklabels([d[:50] for d in domains], fontsize=8)
        ax.set_xlabel("Mean Compliance Score (0-7)")
        ax.set_title("Compliance by Risk Domain × Modality")
        ax.legend(title="Modality")
        ax.set_xlim(left=0)
        fig.tight_layout()
        fig.savefig(output_dir / "risk_domain.png", dpi=150)
        print(f"  Saved {output_dir / 'risk_domain.png'}")
        plt.close(fig)


def main():
    if len(sys.argv) > 1:
        log_path = Path(sys.argv[1])
    else:
        log_path = find_latest_log()

    print(f"Analyzing: {log_path}\n")
    rows = load_eval_log(log_path)

    if not rows:
        print("No scored samples found in log.")
        return

    df = pd.DataFrame(rows)
    analyze(df)

    print(f"\nGenerating plots -> {FIGURES_DIR}/")
    plot(df, FIGURES_DIR)


if __name__ == "__main__":
    main()
