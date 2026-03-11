from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATASET_PATH = PROJECT_ROOT / "dataset.csv"
VARIANTS_DIR = PROJECT_ROOT / "variants"
LOGS_DIR = PROJECT_ROOT / "logs"
FIGURES_DIR = PROJECT_ROOT / "figures"
DOMAIN_TEMPLATES_PATH = Path(__file__).resolve().parent / "domain_templates.json"
