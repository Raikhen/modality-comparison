.PHONY: variants validate summary missing eval analyze

# Generate variant files via API
variants:
	python3 scripts/generate_variants.py

# Validate variant files
validate:
	python3 -m src.validate validate

summary:
	python3 -m src.validate summary

missing:
	python3 -m src.validate missing

# Run evaluation (usage: make eval MODEL=openai/gpt-4o GRADER=anthropic/claude-sonnet-4-20250514)
MODEL ?= openai/gpt-4o
GRADER ?= anthropic/claude-sonnet-4-20250514
eval:
	inspect eval src/eval_task.py --model $(MODEL) --model-role grader=$(GRADER)

# Analyze results
analyze:
	python3 -m src.analyze
