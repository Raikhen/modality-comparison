#!/usr/bin/env python3
"""
Analyze evaluation results from Inspect logs.

Reads an Inspect .eval log (ZIP archive) and produces factorial analysis
of compliance scores across modality and tone dimensions using ordinal
statistics (median, IQR, Mann-Whitney U, Kruskal-Wallis) with Bonferroni
correction for multiple comparisons.

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
from scipy import stats

from src.config import FIGURES_DIR, LOGS_DIR
from src.schemas import MODALITIES, TONES

PALETTE = {
    "plain_text": "#4C72B0",
    "plain_text_with_history": "#64B5F6",
    "agentic_no_history": "#FFB74D",
    "agentic": "#DD8452",
}


def load_eval_log(log_path: Path) -> tuple[list[dict], list[dict]]:
    """Extract scored samples from an Inspect .eval ZIP log.

    Returns:
        (scored_rows, error_rows) — separated so error rates can be reported.
    """
    scored: list[dict] = []
    errors: list[dict] = []

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

            row = {
                "entry_id": metadata.get("entry_id"),
                "tone": metadata.get("tone"),
                "modality": metadata.get("modality"),
                "risk_domain": metadata.get("risk_domain"),
                "sample_id": sample.get("id", ""),
            }

            if isinstance(value, (int, float)) and value >= 0:
                row["compliance_score"] = value
                scored.append(row)
            else:
                row["error_detail"] = score_info.get("explanation", "")[:200]
                errors.append(row)

    return scored, errors


def find_latest_log() -> Path:
    if not LOGS_DIR.exists():
        raise FileNotFoundError("No logs/ directory found. Run an eval first.")

    log_files = sorted(LOGS_DIR.glob("*.eval"), key=lambda p: p.stat().st_mtime)
    if not log_files:
        raise FileNotFoundError("No .eval log files found in logs/.")
    return log_files[-1]


def _bonferroni(p: float, n_comparisons: int) -> float:
    """Apply Bonferroni correction."""
    return min(p * n_comparisons, 1.0)


def _cliffs_delta(x: np.ndarray, y: np.ndarray) -> float:
    """Cliff's delta effect size for ordinal data.

    Returns a value in [-1, 1]:
      - 0   = no effect
      - ±1  = complete separation
    Thresholds (Romano et al.): |δ|<0.147 negligible, <0.33 small,
    <0.474 medium, otherwise large.
    """
    n_x, n_y = len(x), len(y)
    if n_x == 0 or n_y == 0:
        return 0.0
    more = sum(1 for xi in x for yi in y if xi > yi)
    less = sum(1 for xi in x for yi in y if xi < yi)
    return (more - less) / (n_x * n_y)


def report_error_rates(errors: pd.DataFrame, scored: pd.DataFrame) -> None:
    """Report score extraction failure rates per experimental condition."""
    print("0. SCORE EXTRACTION FAILURES")
    print("-" * 40)
    total = len(errors) + len(scored)
    if total == 0:
        print("  No samples found.")
        return

    print(f"  Total samples attempted: {total}")
    print(f"  Successfully scored:     {len(scored)}")
    print(
        f"  Extraction failures:     {len(errors)} "
        f"({100 * len(errors) / total:.1f}%)"
    )

    if len(errors) == 0:
        return

    print("\n  Failure rate by modality:")
    for m in MODALITIES:
        m_err = len(errors[errors["modality"] == m]) if not errors.empty else 0
        m_ok = len(scored[scored["modality"] == m]) if not scored.empty else 0
        m_total = m_err + m_ok
        if m_total > 0:
            print(f"    {m}: {m_err}/{m_total} ({100 * m_err / m_total:.1f}%)")

    print("\n  Failure rate by tone:")
    for t in TONES:
        t_err = len(errors[errors["tone"] == t]) if not errors.empty else 0
        t_ok = len(scored[scored["tone"] == t]) if not scored.empty else 0
        t_total = t_err + t_ok
        if t_total > 0:
            print(f"    {t}: {t_err}/{t_total} ({100 * t_err / t_total:.1f}%)")


def analyze(df: pd.DataFrame) -> None:
    """Run full factorial analysis with ordinal statistics."""
    present = [m for m in MODALITIES if len(df[df["modality"] == m]) > 0]

    print("\n" + "=" * 70)
    print("MODALITY × TONE FACTORIAL ANALYSIS (ORDINAL STATISTICS)")
    print("=" * 70)

    # --- 1. Main effect of modality ---
    print("\n1. MAIN EFFECT OF MODALITY")
    print("-" * 40)
    for m in present:
        s = df[df["modality"] == m]["compliance_score"]
        print(
            f"  {m:30s}  n={len(s):4d}  "
            f"median={s.median():.1f}  "
            f"IQR=[{s.quantile(0.25):.1f}, {s.quantile(0.75):.1f}]  "
            f"mean={s.mean():.2f}"
        )

    # Pairwise Mann-Whitney U (Bonferroni-corrected)
    pairs = [(a, b) for i, a in enumerate(present) for b in present[i + 1 :]]
    n_pairs = len(pairs)
    if n_pairs > 0:
        print(
            f"\n  Pairwise Mann-Whitney U ({n_pairs} comparisons, "
            f"Bonferroni-corrected):"
        )
        for a, b in pairs:
            x = df[df["modality"] == a]["compliance_score"].values
            y = df[df["modality"] == b]["compliance_score"].values
            u_stat, p_raw = stats.mannwhitneyu(x, y, alternative="two-sided")
            p_adj = _bonferroni(p_raw, n_pairs)
            delta = _cliffs_delta(x, y)
            sig = " *" if p_adj < 0.05 else ""
            print(
                f"    {a} vs {b}: "
                f"U={u_stat:.0f}, p_adj={p_adj:.4f}{sig}, "
                f"Cliff's δ={delta:+.3f}"
            )

    # --- 2. Main effect of tone ---
    print("\n2. MAIN EFFECT OF TONE")
    print("-" * 40)
    present_tones = [t for t in TONES if len(df[df["tone"] == t]) > 0]
    for t in present_tones:
        s = df[df["tone"] == t]["compliance_score"]
        print(
            f"  {t:15s}  n={len(s):4d}  "
            f"median={s.median():.1f}  "
            f"IQR=[{s.quantile(0.25):.1f}, {s.quantile(0.75):.1f}]  "
            f"mean={s.mean():.2f}"
        )

    tone_groups = [
        df[df["tone"] == t]["compliance_score"].values for t in present_tones
    ]
    if len(tone_groups) > 1:
        h_stat, p_val = stats.kruskal(*tone_groups)
        print(f"\n  Kruskal-Wallis H={h_stat:.2f}, p={p_val:.4f}")

    # --- 3. Interaction: modality × tone ---
    print("\n3. INTERACTION: MODALITY × TONE (medians)")
    print("-" * 40)
    cross = df.pivot_table(
        values="compliance_score",
        index="tone",
        columns="modality",
        aggfunc="median",
    )
    print(cross.to_string())

    # --- 4. By risk domain ---
    print("\n4. BY RISK DOMAIN")
    print("-" * 40)
    domains = sorted(df["risk_domain"].unique())
    for domain in domains:
        dsub = df[df["risk_domain"] == domain]
        print(f"\n  {domain}:")
        for m in present:
            s = dsub[dsub["modality"] == m]["compliance_score"]
            if len(s) > 0:
                print(
                    f"    {m:30s}  median={s.median():.1f}  "
                    f"IQR=[{s.quantile(0.25):.1f}, {s.quantile(0.75):.1f}]  "
                    f"n={len(s)}"
                )

    # --- 5. Summary ---
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    total = len(df)
    refusals = len(df[df["compliance_score"] == 0])
    print(f"Total scored samples:        {total}")
    print(
        f"Full refusals (score=0):     {refusals} "
        f"({100 * refusals / total:.1f}%)"
    )
    print(f"Median compliance:           {df['compliance_score'].median():.1f}")
    print(f"Mean compliance:             {df['compliance_score'].mean():.2f}")

    for m in present:
        s = df[df["modality"] == m]["compliance_score"]
        refusal_rate = (s == 0).mean()
        print(f"  Refusal rate — {m}: {100 * refusal_rate:.1f}%")


def plot(df: pd.DataFrame, output_dir: Path) -> None:
    """Generate figures from scored samples."""
    output_dir.mkdir(exist_ok=True)
    present = [m for m in MODALITIES if len(df[df["modality"] == m]) > 0]
    present_tones = [t for t in TONES if len(df[df["tone"] == t]) > 0]
    bar_width = 0.8 / max(len(present), 1)
    x = np.arange(len(present_tones))

    # --- Figure 1: Modality × Tone interaction (median + IQR) ---
    fig, ax = plt.subplots(figsize=(10, 5))
    for i, modality in enumerate(present):
        subset = df[df["modality"] == modality]
        medians, yerr_lo, yerr_hi = [], [], []
        for t in present_tones:
            s = subset[subset["tone"] == t]["compliance_score"]
            med = s.median() if len(s) > 0 else 0
            medians.append(med)
            yerr_lo.append(med - s.quantile(0.25) if len(s) > 0 else 0)
            yerr_hi.append(s.quantile(0.75) - med if len(s) > 0 else 0)
        offset = (i - (len(present) - 1) / 2) * bar_width
        ax.bar(
            x + offset,
            medians,
            bar_width,
            yerr=[yerr_lo, yerr_hi],
            capsize=4,
            label=modality,
            color=PALETTE.get(modality, "#999999"),
            alpha=0.85,
        )
    ax.set_xticks(x)
    ax.set_xticklabels(present_tones)
    ax.set_ylabel("Median Compliance Score (0–7)")
    ax.set_xlabel("Tone")
    ax.set_title("Compliance by Modality × Tone")
    ax.legend(title="Modality", fontsize=8)
    ax.set_ylim(bottom=0)
    fig.tight_layout()
    fig.savefig(output_dir / "modality_x_tone.png", dpi=150)
    print(f"  Saved {output_dir / 'modality_x_tone.png'}")
    plt.close(fig)

    # --- Figure 2: Modality main effect ---
    fig, ax = plt.subplots(figsize=(7, 5))
    mstats = []
    for modality in present:
        s = df[df["modality"] == modality]["compliance_score"]
        mstats.append(
            {
                "modality": modality,
                "median": s.median(),
                "q25": s.quantile(0.25),
                "q75": s.quantile(0.75),
            }
        )
    mstats_df = pd.DataFrame(mstats)
    yerr_lo = mstats_df["median"] - mstats_df["q25"]
    yerr_hi = mstats_df["q75"] - mstats_df["median"]
    ax.bar(
        mstats_df["modality"],
        mstats_df["median"],
        yerr=[yerr_lo, yerr_hi],
        capsize=5,
        color=[PALETTE.get(m, "#999999") for m in mstats_df["modality"]],
        alpha=0.85,
    )
    ax.set_ylabel("Median Compliance Score (0–7)")
    ax.set_title("Main Effect of Modality")
    ax.set_ylim(bottom=0)
    ax.tick_params(axis="x", rotation=20)
    fig.tight_layout()
    fig.savefig(output_dir / "modality_main_effect.png", dpi=150)
    print(f"  Saved {output_dir / 'modality_main_effect.png'}")
    plt.close(fig)

    # --- Figure 3: Refusal rate by modality × tone ---
    fig, ax = plt.subplots(figsize=(10, 5))
    for i, modality in enumerate(present):
        subset = df[df["modality"] == modality]
        refusal_rates = []
        for t in present_tones:
            scores = subset[subset["tone"] == t]["compliance_score"]
            refusal_rates.append(
                (scores == 0).mean() * 100 if len(scores) > 0 else 0
            )
        offset = (i - (len(present) - 1) / 2) * bar_width
        ax.bar(
            x + offset,
            refusal_rates,
            bar_width,
            capsize=4,
            label=modality,
            color=PALETTE.get(modality, "#999999"),
            alpha=0.85,
        )
    ax.set_xticks(x)
    ax.set_xticklabels(present_tones)
    ax.set_ylabel("Refusal Rate (%)")
    ax.set_xlabel("Tone")
    ax.set_title("Refusal Rate by Modality × Tone")
    ax.legend(title="Modality", fontsize=8)
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
        bar_height = 0.8 / max(len(present), 1)
        for i, modality in enumerate(present):
            subset = df[df["modality"] == modality]
            medians = [
                subset[subset["risk_domain"] == d]["compliance_score"].median()
                for d in domains
            ]
            offset = (i - (len(present) - 1) / 2) * bar_height
            ax.barh(
                y + offset,
                medians,
                bar_height,
                label=modality,
                color=PALETTE.get(modality, "#999999"),
                alpha=0.85,
            )
        ax.set_yticks(y)
        ax.set_yticklabels([d[:50] for d in domains], fontsize=8)
        ax.set_xlabel("Median Compliance Score (0–7)")
        ax.set_title("Compliance by Risk Domain × Modality")
        ax.legend(title="Modality", fontsize=8)
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
    scored_rows, error_rows = load_eval_log(log_path)

    if not scored_rows and not error_rows:
        print("No samples found in log.")
        return

    scored_df = pd.DataFrame(scored_rows) if scored_rows else pd.DataFrame()
    error_df = pd.DataFrame(error_rows) if error_rows else pd.DataFrame()

    report_error_rates(error_df, scored_df)

    if scored_df.empty:
        print("\nNo successfully scored samples to analyze.")
        return

    analyze(scored_df)

    print(f"\nGenerating plots -> {FIGURES_DIR}/")
    plot(scored_df, FIGURES_DIR)


if __name__ == "__main__":
    main()
