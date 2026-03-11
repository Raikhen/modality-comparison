from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

Tone = Literal["verbatim", "rephrase_1", "rephrase_2"]
Modality = Literal["plain_text", "plain_text_with_history", "agentic", "agentic_no_history"]

TONES: list[Tone] = ["verbatim", "rephrase_1", "rephrase_2"]
MODALITIES: list[Modality] = ["plain_text", "plain_text_with_history", "agentic", "agentic_no_history"]


class PlainTextVariant(BaseModel):
    tone: Tone
    modality: Modality = "plain_text"
    prompt: str


class AgenticVariant(BaseModel):
    tone: Tone
    modality: Modality = "agentic"
    system_prompt: str
    tools: list[dict]
    files: dict[str, str]
    conversation_history: list[dict[str, str]]
    prompt: str


class EntryVariants(BaseModel):
    entry_id: int
    original_prompt: str
    risk_domain: str
    variants: list[PlainTextVariant | AgenticVariant]


class SampleMetadata(BaseModel, frozen=True):
    """Typed metadata attached to each Inspect Sample for this evaluation."""

    entry_id: int
    tone: Tone
    modality: Modality
    risk_domain: str
    original_prompt: str
