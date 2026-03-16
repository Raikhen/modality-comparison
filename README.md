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
- **Tone** — `verbatim`, `formal`, `casual`

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

```bash
python3 scripts/generate_variants.py
```

### 2. Validate

```bash
python3 -m src.validate summary   # overview of coverage
python3 -m src.validate missing   # list entries without variants
python3 -m src.validate validate  # schema check all variant files
```

### 3. Run evaluation

```bash
inspect eval src/eval_task.py --model openai/gpt-4o \
    --model-role grader=anthropic/claude-sonnet-4-20250514

# Limit sample count for quick iteration
inspect eval src/eval_task.py --model openai/gpt-4o \
    --model-role grader=anthropic/claude-sonnet-4-20250514 \
    -T max_samples=100
```

### 4. Analyze results

```bash
python3 -m src.analyze                        # latest log
python3 -m src.analyze logs/<specific>.eval   # specific log
```

Outputs statistical summaries to stdout and saves figures to `figures/`.

## Project Structure

```
data/                   Input data
  dataset.csv           Source entries with adversarial prompts & rubrics
src/                    Core Python library
  config.py             Path constants
  schemas.py            Pydantic models & type aliases
  dataset.py            Dataset loader
  eval_task.py          Inspect AI evaluation task
  analyze.py            Post-hoc analysis & plotting
  validate.py           Variant file validation CLI
scripts/                Operational scripts
  generate_variants.py  Generate variant JSON files via API
  repair_variants.py    Fix common variant file issues
viewer/                 Next.js variant inspection UI
variants/               Generated variant data (by model)
  claude/               Primary variants used for evaluation
  deepseek/             Benchmark variants from DeepSeek
  gemini/               Benchmark variants from Gemini
```

## Requirements

- Python 3.11+
- API keys for the model providers you want to evaluate (OpenAI, Anthropic,
  Google)
