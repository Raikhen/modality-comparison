import type { Variant } from "@/lib/types";
import { MessageBubble } from "./MessageBubble";

/**
 * Renders the exact model input for a variant, mirroring _build_sample()
 * from src/eval_task.py:135-187.
 *
 * Order:
 * 1. System prompt (with embedded files if present)
 * 2. Conversation history messages
 * 3. Final user prompt
 */
export function MessageThread({
  variant,
  editing = false,
  onSystemPromptChange,
  onHistoryChange,
  onPromptChange,
}: {
  variant: Variant;
  editing?: boolean;
  onSystemPromptChange?: (content: string) => void;
  onHistoryChange?: (index: number, content: string) => void;
  onPromptChange?: (content: string) => void;
}) {
  // Build system prompt with embedded files (mirrors _build_system_prompt_with_files)
  let systemContent = variant.system_prompt ?? null;
  if (systemContent && variant.files && Object.keys(variant.files).length > 0) {
    let fileSection = "\n\n## Workspace Files\n";
    for (const [fname, content] of Object.entries(variant.files)) {
      fileSection += `\n### ${fname}\n\`\`\`\n${content}\n\`\`\`\n`;
    }
    systemContent += fileSection;
  }

  const history = variant.conversation_history ?? [];

  return (
    <div className="space-y-2">
      {systemContent && (
        <MessageBubble
          role="system"
          content={systemContent}
          onContentChange={
            editing && onSystemPromptChange ? onSystemPromptChange : undefined
          }
        />
      )}

      {history.map((msg, i) => (
        <MessageBubble
          key={i}
          role={msg.role}
          content={msg.content}
          onContentChange={
            editing && onHistoryChange
              ? (content) => onHistoryChange(i, content)
              : undefined
          }
        />
      ))}

      <MessageBubble
        role="user"
        content={variant.prompt}
        isLastUser
        onContentChange={
          editing && onPromptChange ? onPromptChange : undefined
        }
      />
    </div>
  );
}
