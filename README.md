# Modality Comparison

Evaluate LLM guardrail robustness across plain-text and agentic modalities.

## Motivation

Do LLM safety guardrails hold up equally when a harmful request is embedded in
a realistic agentic context (system prompts, tool definitions, conversation
history) versus presented as plain text? This project provides a framework for
answering that question systematically across risk domains and prompt tones.

## How It Works

Each entry in the dataset is expanded into multiple **variants** that cross two
dimensions:

- **Modality** — `plain_text`, `plain_text_with_history`, `agentic`,
  `agentic_no_history`
- **Tone** — `verbatim`, `rephrase_1` (formal), `rephrase_2` (casual)

Variants are evaluated with [Inspect AI](https://inspect.ai). A grader model
scores each response on a 0–7 compliance rubric, and the analysis module
produces factorial breakdowns and figures.

## Setup

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -e .
```

Copy `.env.example` to `.env` (if applicable) and add your API keys for the
model providers you plan to use.

## Workflow

### 1. Generate variants

Use Claude Code with `PROMPT.md` to generate variant JSON files from
`dataset.csv` into `variants/`.

### 2. Validate

```bash
python3 -m src.validate summary   # overview of coverage
python3 -m src.validate missing   # list entries without variants
python3 -m src.validate validate  # schema check all variant files
```

### 3. Run evaluation

```bash
inspect eval src/eval_task.py --model openai/gpt-4o

# Limit sample count for quick iteration
inspect eval src/eval_task.py --model openai/gpt-4o -T max_samples=100

# Override the grader model
inspect eval src/eval_task.py --model openai/gpt-4o \
    --model-role grader=anthropic/claude-sonnet-4-20250514
```

### 4. Analyze results

```bash
python3 -m src.analyze                        # latest log
python3 -m src.analyze logs/<specific>.eval   # specific log
```

Outputs statistical summaries to stdout and saves figures to `figures/`.

## Project Structure

```
src/
  config.py             Path constants
  schemas.py            Pydantic models & type aliases
  dataset.py            Dataset loader
  eval_task.py          Inspect AI evaluation task
  analyze.py            Post-hoc analysis & plotting
  validate.py           Variant file validation CLI
dataset.csv             Source entries with adversarial prompts & rubrics
scripts/
  generate_ralphy_tasks.py  Generates per-entry Ralphy task files
```

## Requirements

- Python 3.11+
- API keys for the model providers you want to evaluate (OpenAI, Anthropic,
  Google)
