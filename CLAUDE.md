# Modality Comparison — Development Guide

## Project Overview

This project evaluates **LLM guardrail robustness** across modalities. It tests
whether models are more or less likely to comply with harmful requests when
presented in different ways (plain text vs. agentic context) and tones
(verbatim, formal, casual).

## Architecture

```
dataset.csv → scripts/generate_ralphy_tasks.py → tasks/entry_<ID>.md
                                                       │
                                                  ralphy --prd tasks/
                                                       │
                                                 variants/<ID>.json
                                                       ↓
                                           src/eval_task.py  (Inspect AI)
                                                       ↓
                                                 logs/*.eval
                                                       ↓
                                           src/analyze.py → figures/*.png
```

### Key modules

| Module | Purpose |
|---|---|
| `src/config.py` | Central path definitions — all other modules import from here |
| `src/schemas.py` | Pydantic models & Literal type aliases for tones/modalities |
| `src/dataset.py` | Loads `dataset.csv` into `Entry` dataclasses |
| `src/eval_task.py` | Inspect AI `@task` — multi-turn eval with mock tool execution |
| `src/analyze.py` | Post-hoc analysis of `.eval` logs (stats + figures) |
| `src/validate.py` | CLI tool for checking variant file integrity |
| `scripts/generate_ralphy_tasks.py` | Generates per-entry Ralphy task files |

## Running Commands

```bash
# Build variants: generate task files then run Ralphy
python3 scripts/generate_ralphy_tasks.py
ralphy --prd tasks/ --parallel --max-parallel 10 --max-retries 5

# Validate built variants
python3 -m src.validate validate
python3 -m src.validate summary
python3 -m src.validate missing

# Run evaluation (grader model override is REQUIRED):
inspect eval src/eval_task.py --model openai/gpt-4o \
    --model-role grader=anthropic/claude-sonnet-4-20250514

inspect eval src/eval_task.py --model openai/gpt-4o \
    --model-role grader=anthropic/claude-sonnet-4-20250514 \
    -T max_samples=100

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

**Tone** (3 levels, persona-based, length-controlled ±20%):
- `verbatim` — exact original prompt
- `formal` — professional register, no added framing/authority
- `casual` — informal register, no removed specifics

### Controls

- System prompt, tools, files, and tool_responses are **identical across tones** within an entry
- Conversation history content is consistent across tones (only register differs)
- Verbatim conversation history matches the prompt author's writing style
- Tone rephrasing changes **only** linguistic register, not content or length
- Mock tool responses simulate real tool behavior (tools have no guardrails)
- Grader model must differ from eval model (enforced at runtime)

### Pre-registered Hypotheses

These hypotheses were specified before analyzing results. All tests use
non-parametric methods (Mann-Whitney U, Kruskal-Wallis) with Bonferroni
correction for multiple comparisons.

**H1 (Modality main effect):** The full agentic modality produces higher
median compliance scores than plain_text.

**H2 (Conversation history effect):** plain_text_with_history produces
higher compliance than plain_text, isolating the effect of social proof
from prior engagement.

**H3 (Role framing effect):** agentic_no_history produces higher
compliance than plain_text, isolating the effect of system prompt + tools.

**H4 (Additivity):** The full agentic condition produces higher compliance
than either partial condition alone (plain_text_with_history or
agentic_no_history).

**H5 (Tone null hypothesis):** Tone has no significant effect on compliance
scores when controlling for modality — tone variations are register-only
and should not materially affect guardrail behavior.

**H6 (Domain moderation):** The modality effect varies by risk domain
(interaction effect).

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
  `{entry_id}_{tone}_{modality}`.

### Python / Code Style

- **All source lives in `src/`**. No standalone scripts in the project root.
  Run modules as `python3 -m src.<module>` from the project root.
- **Single source of truth for paths**: all path constants live in `src/config.py`.
  Never define `PROJECT_ROOT` or `DATASET_PATH` in other modules.
- **No `sys.path` manipulation**. The `-m` invocation handles imports correctly.
- **Use Literal types** for fixed string enums (`Tone`, `Modality` in
  `src/schemas.py`). Export canonical lists (`TONES`, `MODALITIES`) for
  iteration.
- **Data goes in data files**, not inlined in Python source.
- **No print side effects** in library functions (e.g., `load_entries` should
  not print). Reserve print/logging for CLI entry points.
- **Pydantic for validation**: use `EntryVariants` to validate variant JSON
  files; use `SampleMetadata` for Inspect sample metadata.

### Evaluation Workflow

1. **Build** variants: `python3 scripts/generate_ralphy_tasks.py` then `ralphy --prd tasks/ --parallel --max-parallel 10 --max-retries 5`
2. **Validate** completeness: `python3 -m src.validate summary`
3. **Run** eval: `inspect eval src/eval_task.py --model <model> --model-role grader=<model>`
4. **Analyze** results: `python3 -m src.analyze`

### Adding a New Risk Domain

1. Add entries to `dataset.csv`
2. Re-run `python3 scripts/generate_ralphy_tasks.py` (generates tasks only for missing entries)
3. Run Ralphy to generate variants for the new entries

### Files to Never Commit

- `.env` — API keys
- `variants/` — large generated data
- `logs/` — evaluation logs
- `figures/` — generated plots
- `__pycache__/` — bytecode
