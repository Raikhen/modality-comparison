import type { Variant } from "@/lib/types";
import { MessageBubble } from "./MessageBubble";

/**
 * Renders the exact model input for a variant, mirroring _build_sample()
 * from src/eval_task.py.
 *
 * Order:
 * 1. System prompt (with file listing if files are present)
 * 2. Conversation history messages
 * 3. Final user prompt
 *
 * File contents are NOT embedded in the system prompt — the model accesses
 * them via read_file/list_files tools at runtime.
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
  // Build system prompt with file listing (mirrors _build_system_prompt_with_file_listing)
  let systemContent = variant.system_prompt ?? null;
  if (systemContent && variant.files && Object.keys(variant.files).length > 0) {
    const fileList = Object.keys(variant.files)
      .map((fname) => `  ${fname}`)
      .join("\n");
    systemContent += `\n\nYour workspace contains the following files:\n${fileList}`;
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
