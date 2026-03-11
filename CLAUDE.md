# Modality Comparison — Development Guide

## Project Overview

This project evaluates **LLM guardrail robustness** across modalities. It tests
whether models are more or less likely to comply with harmful requests when
presented in different ways (plain text vs. agentic context) and tones
(verbatim, formal, casual).

## Architecture

```
dataset.csv → PROMPT.md (Claude Code) → variants/<ID>.json
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
| `PROMPT.md` | Instructions for Claude Code to generate variant JSON files |
| `src/eval_task.py` | Inspect AI `@task` — the core evaluation |
| `src/analyze.py` | Post-hoc analysis of `.eval` logs (stats + figures) |
| `src/validate.py` | CLI tool for checking variant file integrity |
| `src/domain_templates.json` | Domain-specific agentic context templates |

## Running Commands

```bash
# Build variants: use Claude Code with PROMPT.md
# e.g., point Claude Code at specific entry IDs and follow PROMPT.md instructions

# Validate built variants
python3 -m src.validate validate
python3 -m src.validate summary
python3 -m src.validate missing

# Run evaluation
inspect eval src/eval_task.py --model openai/gpt-4o
inspect eval src/eval_task.py --model openai/gpt-4o -T max_samples=100

# Override grader model
inspect eval src/eval_task.py --model openai/gpt-4o \
    --model-role grader=anthropic/claude-sonnet-4-20250514

# Analyze results
python3 -m src.analyze
python3 -m src.analyze logs/<specific-log>.eval
```

## Best Practices

### Inspect AI

- **Use `@task` parameters** for anything you might want to vary from the CLI
  (e.g., `max_samples`, grader settings). Expose via `-T key=value`.
- **Use `get_model("grader")`** in scorers so the grader model can be overridden
  with `--model-role grader=<model>` without changing code.
- **Use `MemoryDataset` with a `name`** so logs clearly identify the dataset.
- **Set `fail_on_error`** on `Task` to tolerate a fraction of sample failures
  rather than aborting the entire evaluation run.
- **Set `name` and `version`** on `Task` for traceable eval logs.
- **Scorer metrics**: Use `mean()` and `stderr()` for continuous scores; use
  `accuracy()` and `stderr()` for categorical scores.
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
- **Data goes in data files**. Large domain-specific templates live in
  `src/domain_templates.json`, not inlined in Python source.
- **No print side effects** in library functions (e.g., `load_entries` should
  not print). Reserve print/logging for CLI entry points.
- **Pydantic for validation**: use `EntryVariants` to validate variant JSON
  files; use `SampleMetadata` for Inspect sample metadata.

### Evaluation Workflow

1. **Build** variants: use Claude Code with `PROMPT.md`
2. **Validate** completeness: `python3 -m src.validate summary`
3. **Run** eval: `inspect eval src/eval_task.py --model <model>`
4. **Analyze** results: `python3 -m src.analyze`

### Adding a New Risk Domain

1. Add entries to `dataset.csv`
2. Add a new top-level key to `src/domain_templates.json` with
   `system_prompts`, `tool_sets`, `file_sets`, and `conversation_templates`
3. Follow `PROMPT.md` instructions with Claude Code to generate variants
   for the new entries

### Files to Never Commit

- `.env` — API keys
- `variants/` — large generated data
- `logs/` — evaluation logs
- `figures/` — generated plots
- `__pycache__/` — bytecode
