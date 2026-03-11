from __future__ import annotations

import csv
from dataclasses import dataclass

from src.config import DATASET_PATH


@dataclass
class Entry:
    id: int
    prompt: str
    rubric: str
    risk_domain: str
    risk_subdomain: str
    benign_prompt: str


def load_entries(limit: int | None = None) -> list[Entry]:
    """Load entries from dataset CSV.

    Args:
        limit: Maximum number of entries to load.  ``None`` loads all.
    """
    entries: list[Entry] = []
    with open(DATASET_PATH, newline="") as f:
        for i, row in enumerate(csv.DictReader(f)):
            if limit is not None and i >= limit:
                break
            entries.append(
                Entry(
                    id=int(row["ID"]),
                    prompt=row["adversarial_prompt"],
                    rubric=row["rubric"],
                    risk_domain=row["risk_domain"],
                    risk_subdomain=row["risk_subdomain"],
                    benign_prompt=row["benign_prompt"],
                )
            )
    return entries
