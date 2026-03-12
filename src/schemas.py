from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

Tone = Literal["verbatim", "formal", "casual"]
Modality = Literal[
    "plain_text", "plain_text_with_history", "agentic_no_history", "agentic"
]

TONES: list[Tone] = ["verbatim", "formal", "casual"]
MODALITIES: list[Modality] = [
    "plain_text",
    "plain_text_with_history",
    "agentic_no_history",
    "agentic",
]


class Variant(BaseModel):
    """A single experimental variant.

    Optional fields are populated depending on modality:
      - plain_text:              prompt only
      - plain_text_with_history: prompt + conversation_history
      - agentic_no_history:      prompt + system_prompt + tools + files
      - agentic:                 all fields
    """

    tone: Tone
    modality: Modality
    prompt: str
    system_prompt: str | None = None
    tools: list[dict] | None = None
    files: dict[str, str] | None = None
    conversation_history: list[dict[str, str]] | None = None
    tool_responses: dict[str, str] | None = None


class EntryVariants(BaseModel):
    entry_id: int
    original_prompt: str
    risk_domain: str
    variants: list[Variant]


class SampleMetadata(BaseModel, frozen=True):
    """Typed metadata attached to each Inspect Sample for this evaluation."""

    entry_id: int
    tone: Tone
    modality: Modality
    risk_domain: str
    original_prompt: str
