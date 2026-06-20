import type { ClassificationResult } from './classify'
import type { SemanticState } from './semanticState'
import {
  BASE_BLOCK, INTENT_BLOCKS, LAYOUT_BLOCKS, MERGE_BLOCK, FETCH_IMAGES_BLOCK,
  buildSemanticContextBlock,
} from './promptBlocks'
import { EXAMPLES } from './promptExamples'

export function composeSystemPrompt(
  classification:  ClassificationResult,
  mode:            'replace' | 'merge',
  semanticState?:  SemanticState,
): string {
  const blocks: string[] = [BASE_BLOCK]

  // Semantic context goes right after BASE_BLOCK so it's in the model's
  // strongest attention zone, before intent/layout instructions
  if (semanticState) {
    const contextBlock = buildSemanticContextBlock(semanticState)
    if (contextBlock) blocks.push(contextBlock)
  }

  blocks.push(INTENT_BLOCKS[classification.intent])
  blocks.push(LAYOUT_BLOCKS[classification.layoutHint])

  if (mode === 'merge') blocks.push(MERGE_BLOCK)
  if (classification.needsImages) blocks.push(FETCH_IMAGES_BLOCK)

  const example = EXAMPLES[classification.intent]
  if (example) blocks.push(example)

  if (classification.entities.length > 0) {
    blocks.push(`[REQUIRED ENTITIES]\n${classification.entities.join(', ')}`)
  }

  return blocks.join('\n\n')
}
