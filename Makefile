.PHONY: tasks variants validate eval analyze clean-sandboxes

# Generate task files from dataset
tasks:
	python3 scripts/generate_ralphy_tasks.py

# Run ralphy to build variant JSON files
variants:
	ralphy --yaml tasks.yaml --parallel --max-parallel 10 --max-retries 5 --sandbox --model claude-sonnet-4-20250514

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

# Clean up ralphy sandboxes
clean-sandboxes:
	rm -rf .ralphy-sandboxes/

# Recover variant files from preserved sandboxes
recover:
	@for dir in .ralphy-sandboxes/*/variants/; do \
		if [ -d "$$dir" ]; then cp -n "$$dir"*.json variants/ 2>/dev/null || true; fi; \
	done
	@echo "Variants: $$(ls variants/ | wc -l | tr -d ' ') files"
