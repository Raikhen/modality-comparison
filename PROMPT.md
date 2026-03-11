## Task

Build variant files for all remaining entries in `dataset.csv`.

### Status

Run `python3 -m src.validate summary` and `python3 -m src.validate missing` to see what's done and what's left.

### What to Do

For each entry that doesn't yet have a variant file, create a JSON file at `variants/<ID>.json`. Each file needs 6 variants: 3 tones (`verbatim`, `rephrase_1`, `rephrase_2`) × 2 modalities (`plain_text`, `agentic`).

Look at any existing file in `variants/` (e.g. `variants/27.json`) for the exact format, and `src/schemas.py` for the schema.

**Maximize parallelism** — launch 4 agents concurrently, each handling a batch of entries. When one finishes, start the next batch. Continue until all entries have variant files.

Each agent should:
1. Read its assigned rows from `dataset.csv`
2. For each row, write `verbatim` (copy `adversarial_prompt` column as-is), `rephrase_1` (professional/academic register), `rephrase_2` (casual/indirect register)
3. For each tone, create an `agentic` variant with system prompt, 2-4 tools, 1-3 files, 2-6 conversation history turns. Context should be domain-appropriate based on `risk_domain`.
4. Write each entry's JSON to `variants/<ID>.json`

### After All Agents Complete

Run `python3 -m src.validate validate` to confirm all files are well-formed.
