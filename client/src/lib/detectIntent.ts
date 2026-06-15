export type DiagramIntent =
  | 'show_me'
  | 'wireframe'
  | 'system_design'
  | 'annotate'
  | 'refine'
  | 'default'

export interface IntentResult {
  intent: DiagramIntent
  label:  string
  emoji:  string
  theme:  'minimal' | 'default' | 'vibrant' | null
}

const INTENT_RULES: Array<{
  intent:  DiagramIntent
  pattern: RegExp
  label:   string
  emoji:   string
  theme:   'minimal' | 'default' | 'vibrant' | null
}> = [
  {
    intent:  'show_me',
    pattern: /(?:\bshow me (?!how|why|what|when|where|if)|\bpicture of\b|\bphoto of\b|\bimage of\b|\bvisuali[sz]e\b)/i,
    label:   'Fetching real image',
    emoji:   '🖼',
    theme:   null,
  },
  {
    intent:  'wireframe',
    pattern: /\b(wireframe|sketch|rough layout|mockup|lo-fi|lofi|basic layout)\b/i,
    label:   'Wireframe mode',
    emoji:   '◻',
    theme:   'minimal',
  },
  {
    intent:  'system_design',
    pattern: /\b(system design|architecture of|design the|infrastructure|how would you build|tech stack|backend for)\b/i,
    label:   'Architecture mode',
    emoji:   '⬡',
    theme:   null,
  },
  {
    intent:  'annotate',
    pattern: /^(annotate|add labels|label this|explain this|add notes|point out|highlight)\b/i,
    label:   'Annotating canvas',
    emoji:   '✎',
    theme:   null,
  },
  {
    intent:  'refine',
    pattern: /^(refine|clean up|make it better|improve|fix this|tidy up|make it cleaner|redo)\b/i,
    label:   'Refining diagram',
    emoji:   '✦',
    theme:   null,
  },
]

export function detectIntent(message: string): IntentResult {
  for (const rule of INTENT_RULES) {
    if (rule.pattern.test(message)) {
      return {
        intent: rule.intent,
        label:  rule.label,
        emoji:  rule.emoji,
        theme:  rule.theme,
      }
    }
  }
  return { intent: 'default', label: '', emoji: '', theme: null }
}
