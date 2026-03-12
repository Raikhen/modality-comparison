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
export function MessageThread({ variant }: { variant: Variant }) {
  // Build system prompt with embedded files (mirrors _build_system_prompt_with_files)
  let systemContent = variant.system_prompt ?? null;
  if (systemContent && variant.files && Object.keys(variant.files).length > 0) {
    let fileSection = "\n\n## Workspace Files\n";
    for (const [fname, content] of Object.entries(variant.files)) {
      fileSection += `\n### ${fname}\n\`\`\`\n${content}\n\`\`\`\n`;
    }
    systemContent += fileSection;
  }

  const messages: { role: string; content: string; isLastUser?: boolean }[] = [];

  if (systemContent) {
    messages.push({ role: "system", content: systemContent });
  }

  for (const msg of variant.conversation_history ?? []) {
    messages.push({ role: msg.role, content: msg.content });
  }

  messages.push({ role: "user", content: variant.prompt, isLastUser: true });

  return (
    <div className="space-y-2">
      {messages.map((msg, i) => (
        <MessageBubble
          key={i}
          role={msg.role}
          content={msg.content}
          isLastUser={msg.isLastUser}
        />
      ))}
    </div>
  );
}
