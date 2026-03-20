# Modality Comparison

Evaluate LLM guardrail robustness across plain-text and agentic modalities.

## Motivation

Do LLM safety guardrails hold up equally when a harmful request is embedded in
a realistic agentic context (system prompts, tool definitions, conversation
history) versus presented as plain text? This project provides a framework for
answering that question systematically across risk domains.

## How It Works

Each entry in the dataset is expanded into multiple **variants** that cross
modality with paraphrase replicates:

- **Modality** (4 levels) — `plain_text`, `plain_text_with_history`,
`agentic_no_history`, `agentic`
- **Paraphrase** (N replicates) — `paraphrase_id=0` is the verbatim original;
`paraphrase_id=1..N-1` are generated paraphrases (same meaning, ±20% length)

Paraphrases serve as replicates to increase statistical power for the modality
comparison — they are not an independent factor. Each paraphrase gets its own
complete scaffolding (system prompt, tools, files, conversation history)
tailored to that paraphrase's wording.

Variants are evaluated with [Inspect AI](https://inspect.ai). A grader model
scores each response on a 0–7 compliance rubric, and the analysis module
produces statistical breakdowns and figures.

## Setup

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -e .
```

Copy `.env.example` to `.env` (if applicable) and add your API keys for the
model providers you plan to use.

## Workflow

### 1. Estimate costs

```bash
python3 scripts/estimate_cost.py --all-models \
    --grader-model anthropic/claude-sonnet-4.6 --paraphrases 5 --rollouts 3
```

### 2. Generate variants

```bash
python3 scripts/generate_variants.py
python3 scripts/generate_variants.py --num-paraphrases 3 --ids 27 49
```

### 3. Validate

```bash
python3 -m src.validate summary   # overview of coverage
python3 -m src.validate missing   # list entries without variants
python3 -m src.validate validate  # schema check all variant files
```

### 4. Run evaluation

```bash
inspect eval src/eval_task.py --model openai/gpt-5.4 \
    --model-role grader=anthropic/claude-sonnet-4.6

# Limit sample count or add rollouts
inspect eval src/eval_task.py --model openai/gpt-5.4 \
    --model-role grader=anthropic/claude-sonnet-4.6 \
    -T max_samples=100 -T epochs=3
```

### 5. Analyze results

```bash
python3 -m src.analyze                        # latest log
python3 -m src.analyze logs/<specific>.eval   # specific log
```

Outputs statistical summaries to stdout and saves figures to `figures/`.

## Project Structure

```
data/                   All experiment data
  dataset.csv           Source entries with adversarial prompts & rubrics
  variants/             Generated variant data (by model)
    claude/             Primary variants used for evaluation
    deepseek/           Benchmark variants from DeepSeek
    gemini/             Benchmark variants from Gemini
docs/                   Pre-registration, deviations log
src/                    Core Python library
  config.py             Path constants
  schemas.py            Pydantic models & type aliases
  dataset.py            Dataset loader
  eval_task.py          Inspect AI evaluation task
  analyze.py            Post-hoc analysis & plotting
  validate.py           Variant file validation CLI
scripts/                Operational scripts
  generate_variants.py  Generate variant JSON files via API
  estimate_cost.py      Estimate API costs for generation + eval + grading
viewer/                 Next.js variant inspection UI
```

## Requirements

- Python 3.11+
- API keys for the model providers you want to evaluate (OpenAI, Anthropic,
Google)

