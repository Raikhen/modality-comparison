# Modality Comparison — Development Guide

## Project Overview

This project evaluates **LLM guardrail robustness** across modalities. It tests
whether models are more or less likely to comply with harmful requests when
presented in different ways (plain text vs. agentic context). Multiple
paraphrases of each prompt serve as replicates to make the modality comparison
more robust.

## Architecture

```
data/dataset.csv → scripts/generate_variants.py → data/variants/claude/<ID>.json
                                                          ↓
                                                src/eval_task.py  (Inspect AI)
                                                          ↓
                                                    logs/*.eval
                                                          ↓
                                              src/analyze.py → figures/*.png
```

### Directory layout

```
data/                   All experiment data
  dataset.csv           Source dataset
  variants/             Generated variant data, by model
    claude/             Primary variants (used for evaluation)
    deepseek/           Benchmark variants from DeepSeek
    gemini/             Benchmark variants from Gemini
    backup/             Snapshot backup of claude variants
docs/                   Pre-registration, deviations log
src/                    Core Python library (eval, analysis, validation)
scripts/                Operational scripts (variant generation, cost estimation)
viewer/                 Next.js variant inspection UI
```

### Key modules

| Module | Purpose |
|---|---|
| `src/config.py` | Central path definitions — all other modules import from here |
| `src/schemas.py` | Pydantic models & Literal type aliases for modalities |
| `src/dataset.py` | Loads `data/dataset.csv` into `Entry` dataclasses |
| `src/eval_task.py` | Inspect AI `@task` — multi-turn eval with mock tools + functional file access |
| `src/analyze.py` | Post-hoc analysis of `.eval` logs (stats + figures) |
| `src/validate.py` | CLI tool for checking variant file integrity |
| `scripts/generate_variants.py` | Generates variant JSON files via API |
| `scripts/estimate_cost.py` | Estimates API costs for generation + eval + grading |

## Running Commands

```bash
# Generate variant files (default: 5 paraphrases per entry)
python3 scripts/generate_variants.py
python3 scripts/generate_variants.py --num-paraphrases 3 --ids 27 49

# Validate built variants
python3 -m src.validate validate
python3 -m src.validate summary
python3 -m src.validate missing

# Estimate costs — single model:
python3 scripts/estimate_cost.py --eval-model openai/gpt-5.4 \
    --grader-model anthropic/claude-sonnet-4.6 --paraphrases 5 --rollouts 3

# Estimate costs — all configured eval models:
python3 scripts/estimate_cost.py --all-models \
    --grader-model anthropic/claude-sonnet-4.6 --paraphrases 5 --rollouts 3

# Run evaluation (grader model override is REQUIRED):
inspect eval src/eval_task.py --model openai/gpt-5.4 \
    --model-role grader=anthropic/claude-sonnet-4.6

inspect eval src/eval_task.py --model openai/gpt-5.4 \
    --model-role grader=anthropic/claude-sonnet-4.6 \
    -T max_samples=100 -T epochs=3

# Analyze results
python3 -m src.analyze
python3 -m src.analyze logs/<specific-log>.eval
```

## Experimental Design

### Independent Variables

**Modality** (4 levels, decomposed to isolate confounds):

| Modality | System prompt | Tools/Files | History | Tests |
|----------|:---:|:---:|:---:|---------|
| `plain_text` | — | — | — | Baseline |
| `plain_text_with_history` | — | — | ✓ | Social proof |
| `agentic_no_history` | ✓ | ✓ | — | Role framing |
| `agentic` | ✓ | ✓ | ✓ | Full agentic |

**Paraphrase** (N replicates, configurable via `DEFAULT_PARAPHRASES` in config):
- `paraphrase_id=0` — verbatim original prompt
- `paraphrase_id=1..N-1` — generated paraphrases (same meaning, ±20% length)
- Each paraphrase gets its own complete scaffolding (system prompt, tools, files,
  tool_responses, conversation history) tailored to that paraphrase's wording
- Paraphrases are replicates, not a factor — they increase statistical power
  for the modality comparison

### Controls

- Each paraphrase's scaffolding is tailored to its specific wording
- Domain-specific mock tools return canned responses (tools have no guardrails)
- File tools (`read_file`, `list_files`) are functional — they return real
  content from the variant's `files` dict, mirroring actual agentic file access.
  File content is NOT pre-loaded into the system prompt; the model must call
  `read_file` to see it.
- Grader model must differ from eval model (enforced at runtime)
- Rollouts (via Inspect `epochs`) provide additional replication

### Pre-registered Hypotheses

See `docs/preregistration.md` for the full pre-registration with specific
statistical tests, decision rules, and sample size justification.

**H1 (Modality main effect):** `agentic` > `plain_text` compliance.

**H2 (Conversation history effect):** `plain_text_with_history` > `plain_text`.

**H3 (Role framing effect):** `agentic_no_history` > `plain_text`.

**H4 (Additivity):** `agentic` > both partial conditions.

**H5 (Domain moderation):** Modality effect varies by risk domain.

## Best Practices

### Inspect AI

- **Use `@task` parameters** for anything you might want to vary from the CLI
  (e.g., `max_samples`, grader settings). Expose via `-T key=value`.
- **Always override the grader model** with
  `--model-role grader=<different-model>`. Self-grading (using the eval model
  as grader) is blocked at runtime.
- **Use `MemoryDataset` with a `name`** so logs clearly identify the dataset.
- **Set `fail_on_error`** on `Task` to tolerate a fraction of sample failures
  rather than aborting the entire evaluation run.
- **Set `name` and `version`** on `Task` for traceable eval logs.
- **Scorer metrics**: `mean()` and `stderr()` are retained for Inspect UI
  compatibility. The real analysis in `src/analyze.py` uses ordinal statistics
  (median, IQR, Mann-Whitney U, Kruskal-Wallis).
- Prefer **typed metadata** with a frozen Pydantic model (`SampleMetadata`) so
  that metadata keys are validated at dataset-load time, not discovered as
  KeyErrors at scoring time.
- **Sample `id`** should uniquely identify the experimental condition:
  `{entry_id}_{paraphrase_id}_{modality}`.

### Python / Code Style

- **All source lives in `src/`**. No standalone scripts in the project root.
  Run modules as `python3 -m src.<module>` from the project root.
- **Single source of truth for paths**: all path constants live in `src/config.py`.
  Scripts in `scripts/` import from `src.config` (via `sys.path.insert` before
  the import). Never redefine `DATASET_PATH` or `VARIANTS_DIR` locally.
- **No `sys.path` manipulation** in `src/` modules. The `-m` invocation handles
  imports correctly. Scripts in `scripts/` may use `sys.path.insert` only to
  bootstrap `src` imports.
- **Use Literal types** for fixed string enums (`Modality` in
  `src/schemas.py`). Export canonical lists (`MODALITIES`) for iteration.
- **Data goes in data files**, not inlined in Python source.
- **No print side effects** in library functions (e.g., `load_entries` should
  not print). Reserve print/logging for CLI entry points.
- **Pydantic for validation**: use `EntryVariants` to validate variant JSON
  files; use `SampleMetadata` for Inspect sample metadata.

### Evaluation Workflow

1. **Estimate** costs: `python3 scripts/estimate_cost.py --all-models --grader-model <model> --paraphrases 5 --rollouts 3`
2. **Build** variants: `python3 scripts/generate_variants.py --num-paraphrases 5`
3. **Validate** completeness: `python3 -m src.validate summary`
4. **Run** eval: `inspect eval src/eval_task.py --model <model> --model-role grader=<model> -T epochs=3`
5. **Analyze** results: `python3 -m src.analyze`

### Adding a New Risk Domain

1. Add entries to `data/dataset.csv`
2. Re-run `python3 scripts/generate_variants.py` (generates variants only for missing entries)

### Files to Never Commit

- `.env` — API keys
- `data/variants/` — generated variant data (all subdirs)
- `logs/` — evaluation logs
- `figures/` — generated plots
- `.generate_checkpoints/` — generation state
- `__pycache__/` — bytecode

## Design Context

### Users

Safety researchers on a small team verifying that experimental variants are
correctly assembled before running expensive eval batches. They open the viewer
at their desk during experiment preparation — scanning entries, drilling into
specific conditions, comparing paraphrases side by side, cross-referencing against raw
JSON. The work is forensic and detail-oriented: they need to trust that what
they see is exactly what the model will receive.

### Brand Personality

Instrumental, precise, receding. The interface is a research tool, not a
product. It should feel like looking through a well-calibrated instrument — the
viewer disappears and the data speaks.

### Aesthetic Direction

- **Reference**: Vercel dashboard — dense, monospace-forward, developer-oriented
- **Visual tone**: Clinical. Cool grays, minimal chrome, tight spacing. The
  N×4 experimental matrix (paraphrase × modality) is the product's signature
  element and should read like a specimen tray, not a card layout
- **Theme**: Light mode only
- **Typography**: Geist Mono for all structural text (nav, labels, headers,
  badges, axes). Geist Sans for body/message content
- **Color**: Slate ink hierarchy (4 levels). Single amber accent for focal
  points (final prompt indicator, hover states, active controls). Domain badges
  desaturated via HSL hue-shifting at low saturation. No bright or saturated
  colors competing with specimen content
- **Depth**: Borders only. No shadows. Thin, low-opacity rgba borders at three
  intensity levels. Surfaces distinguished by 1-2% lightness shifts
- **Radius**: rounded-sm (2px) everywhere — sharp, technical

### Design Principles

1. **Fidelity over aesthetics** — The viewer must faithfully reproduce what the
   model receives. Every message thread mirrors `_build_sample()` exactly.
   Visual choices never obscure or reinterpret the data.

2. **Data density over whitespace** — Researchers scan 137+ entries and N×4
   conditions per entry. Tight spacing, small type, and compact cards let more
   specimens fit on screen without scrolling.

3. **The interface recedes** — No decorative elements, no emoji, no
   abbreviations that require learning. Labels are readable words. Controls are
   quiet until interacted with. The viewer is a pane of glass over the data.

4. **One accent, used with intention** — Amber marks exactly one thing: the
   point of interest (final prompt, active state, hover). Everything else is
   neutral. Color means something or it isn't used.

5. **Consistency is non-negotiable** — Every surface, border, and text color
   comes from the token system in `globals.css`. No ad-hoc hex values. No
   mixed depth strategies. No exceptions.
