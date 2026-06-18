import type { ChatCompletionToolChoiceOption } from 'groq-sdk/resources/chat/completions'

export const TOOL_CHOICE_AUTO: ChatCompletionToolChoiceOption = 'auto'

export function forceTool(name: string): ChatCompletionToolChoiceOption {
  return { type: 'function', function: { name } }
}
