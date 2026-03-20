from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
DATASET_PATH = DATA_DIR / "dataset.csv"
VARIANTS_DIR = PROJECT_ROOT / "data" / "variants" / "claude"
LOGS_DIR = PROJECT_ROOT / "logs"
FIGURES_DIR = PROJECT_ROOT / "figures"

DEFAULT_PARAPHRASES = 5

# Models to evaluate for guardrail robustness. Covers efficient, open-source,
# and reasoning models across major providers.
EVAL_MODELS: list[str] = [
    # Efficient closed-source
    "openai/gpt-5-mini",
    "anthropic/claude-haiku-4.5",
    "google/gemini-3.1-flash-lite-preview",
    # Open-source
    "meta-llama/llama-4-maverick",
    "deepseek/deepseek-v3.2",
    # Reasoning
    "deepseek/deepseek-r1",
]

DEFAULT_GRADER = "anthropic/claude-haiku-4.5"
