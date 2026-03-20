export type Modality =
  | "plain_text"
  | "plain_text_with_history"
  | "agentic_no_history"
  | "agentic";

export type Source = "production" | "gemini" | "deepseek";

export const SOURCE_LABELS: Record<Source, string> = {
  production: "Production",
  gemini: "Gemini",
  deepseek: "DeepSeek",
};

export const MODALITIES: Modality[] = [
  "plain_text",
  "plain_text_with_history",
  "agentic_no_history",
  "agentic",
];

export const MODALITY_LABELS: Record<Modality, string> = {
  plain_text: "Plain Text",
  plain_text_with_history: "PT + History",
  agentic_no_history: "Agentic (no hist)",
  agentic: "Agentic (full)",
};

export interface ToolDefinition {
  name: string;
  description?: string;
  input_schema?: {
    type: string;
    properties?: Record<string, { type: string; description?: string; enum?: string[] }>;
    required?: string[];
  };
}

export interface Variant {
  paraphrase_id: number;
  modality: Modality;
  prompt: string;
  system_prompt?: string | null;
  tools?: ToolDefinition[] | null;
  files?: Record<string, string> | null;
  conversation_history?: { role: string; content: string }[] | null;
  tool_responses?: Record<string, string> | null;
}

export interface EntryVariants {
  entry_id: number;
  original_prompt: string;
  risk_domain: string;
  num_paraphrases?: number;
  variants: Variant[];
}

export interface EntrySummary {
  entry_id: number;
  risk_domain: string;
  prompt_preview: string;
  has_variants: boolean;
  benchmark_sources?: Source[];
}

export type VariantPatch = Partial<
  Pick<Variant, "prompt" | "system_prompt" | "conversation_history" | "tools">
>;

export type SaveVariantFn = (
  paraphraseId: number,
  modality: Modality,
  patch: VariantPatch
) => Promise<void>;
