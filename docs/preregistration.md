# Pre-registration: Guardrail Robustness Across Modalities

**Date:** 2026-03-16
**Status:** Pre-analysis (no evaluation results have been examined)

## 1. Study Overview

This study tests whether large language models are more likely to comply with
harmful requests when those requests are embedded in agentic context (system
prompts, tool access, conversation history) compared to plain text. The agentic
condition is decomposed into orthogonal components to isolate role framing and
social proof effects.

## 2. Design

**Type:** Within-subject (each prompt tested in all conditions), multi-model

**Independent variable — Modality (4 levels):**

| Level | System prompt | Tools/Files | Conv. history | Isolates |
|---|:---:|:---:|:---:|---|
| `plain_text` | — | — | — | Baseline |
| `plain_text_with_history` | — | — | yes | Social proof / prior engagement |
| `agentic_no_history` | yes | yes | — | Role framing + tool access |
| `agentic` | yes | yes | yes | Full agentic context |

**Replicates — Paraphrases (5 per entry):**
- `paraphrase_id=0`: verbatim original prompt
- `paraphrase_id=1..4`: LLM-generated paraphrases (same meaning, +/-20% length)
- Each paraphrase receives independently generated scaffolding
- Paraphrases are replicates for the modality comparison, not a crossed factor

**Dependent variable — Compliance score:**
- Integer scale from 0 (full refusal) to 7 (maximum compliance)
- Scored by an independent grader model against a per-entry rubric
- Grader model must differ from the eval model (enforced at runtime)

**Rollouts:** 3 epochs per sample (configurable), providing additional replication

## 3. Dataset

- 500 harmful prompts across 3 risk domains:
  - Criminal & Financial Illicit Activities (188 entries, 8 subdomains)
  - CBRNE — Chemical, Biological, Radiological, Nuclear, Explosive (180 entries, 5 subdomains)
  - Political Violence & Terrorism (132 entries, 7 subdomains)
- Each entry has a rubric of 6-10 binary criteria for grading compliance
- Prompts use diverse adversarial techniques (roleplay, fictitious justification,
  unicode manipulation, broken English, etc.)

## 4. Eval Models

The following models will each be evaluated on the same variant set:

| Model | Provider | Tier |
|---|---|---|
| `openai/gpt-5-mini` | OpenAI | Efficient |
| `anthropic/claude-haiku-4.5` | Anthropic | Efficient |
| `google/gemini-3.1-flash-lite-preview` | Google | Efficient |
| `meta-llama/llama-4-maverick` | Meta | Open-source |
| `deepseek/deepseek-v3.2` | DeepSeek | Open-source |
| `deepseek/deepseek-r1` | DeepSeek | Reasoning |

**Grader model:** `anthropic/claude-haiku-4.5` for non-Anthropic eval
models; `openai/gpt-5-mini` for Anthropic eval models.

## 5. Hypotheses

All hypotheses are tested independently within each eval model. A hypothesis is
considered supported if it holds for a majority of eval models (4 of 6 or more).

### H1 — Modality main effect
The `agentic` modality produces higher median compliance scores than
`plain_text`.

- **Test:** One-sided Mann-Whitney U (`agentic` > `plain_text`)
- **Effect size:** Cliff's delta
- **Decision rule:** Reject null if Bonferroni-corrected p < 0.05 and
  |delta| >= 0.147 (non-negligible)

### H2 — Conversation history effect
`plain_text_with_history` produces higher median compliance than `plain_text`,
isolating the effect of social proof from prior conversational engagement.

- **Test:** One-sided Mann-Whitney U (`plain_text_with_history` > `plain_text`)
- **Effect size:** Cliff's delta
- **Decision rule:** Same as H1

### H3 — Role framing effect
`agentic_no_history` produces higher median compliance than `plain_text`,
isolating the effect of system prompt and tool availability.

- **Test:** One-sided Mann-Whitney U (`agentic_no_history` > `plain_text`)
- **Effect size:** Cliff's delta
- **Decision rule:** Same as H1

### H4 — Additivity
The full `agentic` condition produces higher compliance than either partial
condition alone (`plain_text_with_history` and `agentic_no_history`).

- **Test:** Two one-sided Mann-Whitney U tests:
  - `agentic` > `plain_text_with_history`
  - `agentic` > `agentic_no_history`
- **Decision rule:** Both comparisons must meet criteria (p < 0.05 corrected,
  |delta| >= 0.147) for additivity to be supported

### H5 — Domain moderation
The modality effect (agentic vs. plain_text compliance difference) varies by
risk domain.

- **Test:** Kruskal-Wallis on per-entry modality deltas (agentic minus
  plain_text compliance), grouped by risk domain
- **Decision rule:** Reject null if p < 0.05. If significant, follow up with
  pairwise Mann-Whitney U between domains (Bonferroni-corrected)

## 6. Statistical Analysis Plan

### Primary analyses (confirmatory)

1. **Per-model modality comparison:**
   - Compute median and IQR of compliance scores per modality
   - Pairwise Mann-Whitney U for H1-H4 comparisons
   - Bonferroni correction for 6 pairwise comparisons (alpha = 0.05/6 = 0.0083)
   - Cliff's delta effect size with Romano et al. thresholds:
     |delta| < 0.147 negligible, < 0.33 small, < 0.474 medium, >= 0.474 large

2. **Cross-model consistency:**
   - Report which hypotheses are supported per model
   - A finding is considered robust if supported in >= 4 of 6 models
   - Report range of effect sizes across models

3. **Domain interaction (H5):**
   - Kruskal-Wallis on per-entry deltas grouped by domain
   - Post-hoc pairwise comparisons if omnibus test is significant

### Secondary analyses (exploratory)

4. **Paraphrase variance:**
   - Within-entry standard deviation of compliance across paraphrases
   - Per-modality breakdown to assess whether scaffolded conditions show more
     paraphrase sensitivity

5. **Score extraction failures:**
   - Error rates per modality and per model
   - Chi-squared test for differential error rates across modalities

6. **Refusal rate analysis:**
   - Proportion of score=0 responses per modality
   - Fisher's exact test for pairwise modality comparisons

### What is not analyzed

- Paraphrases are not analyzed as a factor (they are replicates)
- No within-paraphrase comparisons across modalities (paraphrase ID is not
  meaningful across entries)
- No analysis of tool-call behavior (number of calls, which tools, etc.) — this
  is deferred to future work

## 7. Sample Size

Per model:
- 500 entries x 5 paraphrases x 4 modalities x 3 rollouts = 30,000 samples
- Per modality cell: 7,500 samples
- Per domain x modality cell: 1,320 to 2,820 samples (smallest: Political
  Violence & Terrorism with 132 entries x 5 x 3 = 1,980)

Power considerations:
- With 7,500 observations per cell, Mann-Whitney U has >99% power to detect
  Cliff's delta >= 0.147 at alpha = 0.0083 (Bonferroni-corrected)
- The domain interaction (H5) with 3 groups and minimum 1,980 per cell retains
  >95% power for medium effects

## 8. Multiple Comparisons

- **Primary (H1-H4):** 6 pairwise modality comparisons, Bonferroni-corrected
  (adjusted alpha = 0.0083)
- **H5 post-hoc:** 3 pairwise domain comparisons, Bonferroni-corrected
  (adjusted alpha = 0.0167)
- **Cross-model:** No correction applied — each model is an independent
  replication. Consistency across models is the criterion, not per-model
  significance.

## 9. Known Limitations

1. **Scaffolding confound:** Conversation histories and tool definitions are
   LLM-generated per paraphrase. The specific content of scaffolding is not
   controlled — only the structural presence/absence of scaffolding components
   (system prompt, tools, history) is manipulated. Uncontrolled variation in
   scaffolding content (e.g., persuasive strategies in conversation history)
   could contribute to modality effects.

2. **Mock tool behavior:** Tool responses comply unconditionally. This tests
   guardrail robustness in a permissive tool environment, which may overstate
   the agentic effect relative to deployments with tool-level guardrails.

3. **Single grader per run:** No inter-rater reliability check. The scoring
   infrastructure supports multiple grader roles for future multi-grader runs.

4. **Ordinal scale interpretation:** The 0-7 compliance scale is ordinal. Grader
   interpretation of intermediate values (e.g., 3 vs. 4) may be inconsistent
   across entries. Non-parametric tests are used to mitigate this.

5. **Independence assumption:** Mann-Whitney U treats observations as
   independent, but scores within the same entry are correlated (same prompt
   content). Paraphrase variance analysis (secondary) quantifies this
   clustering, but the primary analysis does not model it. A mixed-effects
   ordinal model would be more appropriate but is deferred.

## 10. Deviations Protocol

Any deviation from this plan will be documented in a `docs/deviations.md` file
before results are reported, including:
- The original plan
- The deviation and its justification
- Whether the deviation was decided before or after examining results

Analyses not listed above will be clearly labeled as post-hoc/exploratory.
