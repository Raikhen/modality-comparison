#!/usr/bin/env python3
"""
Cross-model analysis of evaluation results.

Loads all 2026-03-19*.eval logs, combines samples per model (deduplicating
across restarts), and produces cross-model modality comparisons with
statistical tests and figures.

Usage:
    python3 scripts/analyze_all.py
"""

import json
import sys
import zipfile
from collections import defaultdict
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy import stats

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from src.config import FIGURES_DIR, LOGS_DIR
from src.analyze import load_eval_log, _cliffs_delta
from src.schemas import MODALITIES

PALETTE = {
    "plain_text": "#4C72B0",
    "plain_text_with_history": "#64B5F6",
    "agentic_no_history": "#FFB74D",
    "agentic": "#DD8452",
}

MODALITY_SHORT = {
    "plain_text": "plain_text",
    "plain_text_with_history": "pt_history",
    "agentic_no_history": "agentic_no_hist",
    "agentic": "agentic",
}


def extract_model_name(log_path: Path) -> str:
    """Read eval model name from _journal/start.json inside the eval ZIP."""
    with zipfile.ZipFile(log_path) as z:
        start = json.loads(z.read("_journal/start.json"))
    raw = start.get("eval", {}).get("model", "unknown")
    # Strip provider prefix (openrouter/) for cleaner display
    parts = raw.split("/")
    if len(parts) >= 3 and parts[0] in ("openrouter",):
        return "/".join(parts[1:])
    return raw


def load_all_logs() -> pd.DataFrame:
    """Load all 2026-03-19 eval logs, combine per model, deduplicate."""
    log_files = sorted(LOGS_DIR.glob("2026-03-19*.eval"))
    if not log_files:
        print("No 2026-03-19*.eval files found in logs/.")
        sys.exit(1)

    print(f"Found {len(log_files)} log files:\n")

    # Collect rows keyed by model
    model_rows: dict[str, list[dict]] = defaultdict(list)
    model_errors: dict[str, list[dict]] = defaultdict(list)
    model_files: dict[str, list[str]] = defaultdict(list)

    for lf in log_files:
        model = extract_model_name(lf)
        scored, errors = load_eval_log(lf)
        # Add epoch from raw samples for dedup
        with zipfile.ZipFile(lf) as z:
            sample_files = [n for n in z.namelist() if n.startswith("samples/")]
            epoch_map = {}
            for name in sample_files:
                sample = json.loads(z.read(name))
                sid = sample.get("id", "")
                epoch = sample.get("epoch", 1)
                epoch_map[sid] = epoch

        for row in scored:
            row["epoch"] = epoch_map.get(row["sample_id"], 1)
        for row in errors:
            row["epoch"] = epoch_map.get(row.get("sample_id", ""), 1)

        model_rows[model].extend(scored)
        model_errors[model].extend(errors)
        model_files[model].append(lf.name)
        print(f"  {lf.name}")
        print(f"    model: {model}  scored: {len(scored)}  errors: {len(errors)}")

    # Deduplicate per model: keep first occurrence of (sample_id, epoch)
    all_rows = []
    print("\nDeduplication:")
    for model, rows in sorted(model_rows.items()):
        seen = set()
        unique = []
        for r in rows:
            key = (r["sample_id"], r["epoch"])
            if key not in seen:
                seen.add(key)
                r["model"] = model
                unique.append(r)
        dupes = len(rows) - len(unique)
        print(f"  {model}: {len(rows)} raw -> {len(unique)} unique ({dupes} duplicates removed)")
        all_rows.extend(unique)

    df = pd.DataFrame(all_rows)
    return df, model_errors


def print_model_summary(df: pd.DataFrame, model_errors: dict) -> None:
    """Table (a): Per-model summary."""
    print("\n" + "=" * 90)
    print("A. PER-MODEL SUMMARY")
    print("=" * 90)
    header = f"{'Model':<40s} {'N':>6s} {'Errors':>7s} {'Err%':>6s} {'Median':>7s} {'Mean':>7s} {'Refusal%':>9s}"
    print(header)
    print("-" * 90)

    for model in sorted(df["model"].unique()):
        sub = df[df["model"] == model]
        n = len(sub)
        n_err = len(model_errors.get(model, []))
        err_pct = 100 * n_err / (n + n_err) if (n + n_err) > 0 else 0
        median = sub["compliance_score"].median()
        mean = sub["compliance_score"].mean()
        refusal = 100 * (sub["compliance_score"] == 0).mean()
        print(f"  {model:<38s} {n:>6d} {n_err:>7d} {err_pct:>5.1f}% {median:>7.1f} {mean:>7.2f} {refusal:>8.1f}%")


def print_modality_comparison(df: pd.DataFrame) -> None:
    """Table (b): Cross-model modality comparison."""
    print("\n" + "=" * 90)
    print("B. CROSS-MODEL MODALITY COMPARISON")
    print("=" * 90)

    models = sorted(df["model"].unique())
    present_mods = [m for m in MODALITIES if m in df["modality"].values]

    # Header
    mod_headers = "".join(f"{'':>3s}{'median':>7s} {'IQR':>11s} {'n':>5s}" for _ in present_mods)
    print(f"\n{'Model':<30s}", end="")
    for m in present_mods:
        label = MODALITY_SHORT.get(m, m)
        print(f"  |  {label:^25s}", end="")
    print()

    print(f"{'':30s}", end="")
    for _ in present_mods:
        print(f"  |  {'med':>5s} {'IQR':>11s} {'n':>5s}", end="")
    print()
    print("-" * (30 + len(present_mods) * 28))

    for model in models:
        msub = df[df["model"] == model]
        print(f"  {model:<28s}", end="")
        for mod in present_mods:
            s = msub[msub["modality"] == mod]["compliance_score"]
            if len(s) > 0:
                med = s.median()
                q25 = s.quantile(0.25)
                q75 = s.quantile(0.75)
                print(f"  |  {med:>5.1f} [{q25:.0f}-{q75:.0f}]{len(s):>8d}", end="")
            else:
                print(f"  |  {'—':>5s} {'—':>11s} {'0':>5s}", end="")
        print()


def print_statistical_tests(df: pd.DataFrame) -> None:
    """Table (c): Per-model H1 test (plain_text vs agentic)."""
    print("\n" + "=" * 90)
    print("C. STATISTICAL TESTS — H1: plain_text vs agentic (Mann-Whitney U)")
    print("=" * 90)
    print(f"  {'Model':<40s} {'U':>10s} {'p-value':>10s} {'Cliff δ':>10s} {'sig':>5s}")
    print("-" * 90)

    for model in sorted(df["model"].unique()):
        msub = df[df["model"] == model]
        x = msub[msub["modality"] == "plain_text"]["compliance_score"].values
        y = msub[msub["modality"] == "agentic"]["compliance_score"].values
        if len(x) < 2 or len(y) < 2:
            print(f"  {model:<40s} {'insufficient data':>35s}")
            continue
        u_stat, p_val = stats.mannwhitneyu(x, y, alternative="two-sided")
        delta = _cliffs_delta(y, x)  # positive = agentic > plain_text
        sig = "*" if p_val < 0.05 else ""
        print(f"  {model:<40s} {u_stat:>10.0f} {p_val:>10.4f} {delta:>+10.3f} {sig:>5s}")

    print("\n  Cliff's δ interpretation: |δ|<0.147 negligible, <0.33 small, <0.474 medium, ≥0.474 large")
    print("  Positive δ means agentic > plain_text compliance")


def plot_cross_model_modality(df: pd.DataFrame, output_dir: Path) -> None:
    """Figure (d.i): Grouped bar chart of median compliance by model × modality."""
    output_dir.mkdir(exist_ok=True)
    models = sorted(df["model"].unique())
    present_mods = [m for m in MODALITIES if m in df["modality"].values]

    fig, ax = plt.subplots(figsize=(max(10, len(models) * 2.5), 6))
    x = np.arange(len(models))
    width = 0.8 / len(present_mods)

    for i, mod in enumerate(present_mods):
        medians = []
        iqr_lo = []
        iqr_hi = []
        for model in models:
            s = df[(df["model"] == model) & (df["modality"] == mod)]["compliance_score"]
            if len(s) > 0:
                med = s.median()
                medians.append(med)
                iqr_lo.append(med - s.quantile(0.25))
                iqr_hi.append(s.quantile(0.75) - med)
            else:
                medians.append(0)
                iqr_lo.append(0)
                iqr_hi.append(0)

        offset = (i - (len(present_mods) - 1) / 2) * width
        bars = ax.bar(
            x + offset,
            medians,
            width,
            yerr=[iqr_lo, iqr_hi],
            capsize=3,
            label=mod,
            color=PALETTE.get(mod, "#999999"),
            alpha=0.85,
        )

    # Add sample counts below bars
    ax.set_xticks(x)
    short_names = [m.split("/")[-1] for m in models]
    ax.set_xticklabels(short_names, rotation=20, ha="right", fontsize=9)
    ax.set_ylabel("Median Compliance Score (0–7)")
    ax.set_title("Cross-Model Modality Comparison — Median Compliance")
    ax.set_ylim(bottom=0, top=7.5)
    ax.legend(title="Modality", fontsize=8, loc="upper right")
    ax.grid(axis="y", alpha=0.3)
    fig.tight_layout()
    path = output_dir / "cross_model_modality.png"
    fig.savefig(path, dpi=150)
    print(f"  Saved {path}")
    plt.close(fig)


def _wilson_ci(k: int, n: int, z: float = 1.96) -> tuple[float, float]:
    """Wilson score interval for a binomial proportion (percentage scale)."""
    if n == 0:
        return 0.0, 0.0
    p_hat = k / n
    denom = 1 + z**2 / n
    centre = (p_hat + z**2 / (2 * n)) / denom
    margin = z * np.sqrt((p_hat * (1 - p_hat) + z**2 / (4 * n)) / n) / denom
    return 100 * max(centre - margin, 0), 100 * min(centre + margin, 1)


def plot_refusal_rates(df: pd.DataFrame, output_dir: Path) -> None:
    """Figure (d.ii): Grouped bar chart of refusal rate by model × modality with 95% Wilson CIs."""
    output_dir.mkdir(exist_ok=True)
    models = sorted(df["model"].unique())
    present_mods = [m for m in MODALITIES if m in df["modality"].values]

    fig, ax = plt.subplots(figsize=(max(10, len(models) * 2.5), 6))
    x = np.arange(len(models))
    width = 0.8 / len(present_mods)

    for i, mod in enumerate(present_mods):
        rates = []
        ci_lo = []
        ci_hi = []
        for model in models:
            s = df[(df["model"] == model) & (df["modality"] == mod)]["compliance_score"]
            n = len(s)
            if n > 0:
                k = int((s == 0).sum())
                rate = 100 * k / n
                lo, hi = _wilson_ci(k, n)
                rates.append(rate)
                ci_lo.append(rate - lo)
                ci_hi.append(hi - rate)
            else:
                rates.append(0)
                ci_lo.append(0)
                ci_hi.append(0)

        offset = (i - (len(present_mods) - 1) / 2) * width
        ax.bar(
            x + offset,
            rates,
            width,
            yerr=[ci_lo, ci_hi],
            capsize=3,
            label=mod,
            color=PALETTE.get(mod, "#999999"),
            alpha=0.85,
        )

    ax.set_xticks(x)
    short_names = [m.split("/")[-1] for m in models]
    ax.set_xticklabels(short_names, rotation=20, ha="right", fontsize=9)
    ax.set_ylabel("Refusal Rate (score=0, %)")
    ax.set_title("Cross-Model Refusal Rates by Modality (95% Wilson CI)")
    ax.set_ylim(bottom=0, top=105)
    ax.legend(title="Modality", fontsize=8, loc="upper right")
    ax.grid(axis="y", alpha=0.3)
    fig.tight_layout()
    path = output_dir / "refusal_rates.png"
    fig.savefig(path, dpi=150)
    print(f"  Saved {path}")
    plt.close(fig)


def plot_per_modality(df: pd.DataFrame, output_dir: Path) -> None:
    """One figure per modality: bar chart of median compliance per model with IQR."""
    output_dir.mkdir(exist_ok=True)
    models = sorted(df["model"].unique())
    short_names = [m.split("/")[-1] for m in models]
    present_mods = [m for m in MODALITIES if m in df["modality"].values]

    for mod in present_mods:
        fig, ax = plt.subplots(figsize=(max(8, len(models) * 1.5), 5))
        medians = []
        iqr_lo = []
        iqr_hi = []
        ns = []
        for model in models:
            s = df[(df["model"] == model) & (df["modality"] == mod)]["compliance_score"]
            if len(s) > 0:
                med = s.median()
                medians.append(med)
                iqr_lo.append(med - s.quantile(0.25))
                iqr_hi.append(s.quantile(0.75) - med)
                ns.append(len(s))
            else:
                medians.append(0)
                iqr_lo.append(0)
                iqr_hi.append(0)
                ns.append(0)

        bars = ax.bar(
            np.arange(len(models)),
            medians,
            yerr=[iqr_lo, iqr_hi],
            capsize=5,
            color=PALETTE.get(mod, "#999999"),
            alpha=0.85,
        )

        # Annotate sample counts
        for j, (bar, n) in enumerate(zip(bars, ns)):
            ax.text(
                bar.get_x() + bar.get_width() / 2,
                -0.4,
                f"n={n}",
                ha="center",
                va="top",
                fontsize=7,
                color="#666666",
            )

        ax.set_xticks(np.arange(len(models)))
        ax.set_xticklabels(short_names, rotation=20, ha="right", fontsize=9)
        ax.set_ylabel("Median Compliance Score (0–7)")
        ax.set_title(f"Modality: {mod}")
        ax.set_ylim(bottom=-0.8, top=7.5)
        ax.grid(axis="y", alpha=0.3)
        fig.tight_layout()
        path = output_dir / f"modality_{mod}.png"
        fig.savefig(path, dpi=150)
        print(f"  Saved {path}")
        plt.close(fig)


def main():
    print("CROSS-MODEL EVALUATION ANALYSIS")
    print("=" * 90)

    df, model_errors = load_all_logs()

    if df.empty:
        print("\nNo scored samples found across any logs.")
        return

    print(f"\nTotal unique scored samples: {len(df)}")
    print(f"Models: {sorted(df['model'].unique())}")

    print_model_summary(df, model_errors)
    print_modality_comparison(df)
    print_statistical_tests(df)

    print(f"\nGenerating figures -> {FIGURES_DIR}/")
    plot_cross_model_modality(df, FIGURES_DIR)
    plot_refusal_rates(df, FIGURES_DIR)
    plot_per_modality(df, FIGURES_DIR)

    print("\nDone.")


if __name__ == "__main__":
    main()
