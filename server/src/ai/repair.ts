import Groq from 'groq-sdk'
import type { DiagramPlan } from './layout/types'
import { forceTool } from './toolChoice'
import { PLAN_DIAGRAM_TOOL } from './tools'
import { logger } from '../lib/logger'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const MAX_REPAIR_ATTEMPTS = parseInt(process.env.MAX_REPAIR_ATTEMPTS ?? '2', 10)

export interface RepairContext {
  originalUserMessage: string
  systemPrompt:        string
  failedPlanRaw:       unknown
  problems:            string[]
  attempt:             number
  requestId?:          string
  userId?:             string
}

export async function requestRepair(ctx: RepairContext): Promise<DiagramPlan | null> {
  if (ctx.attempt > MAX_REPAIR_ATTEMPTS) {
    logger.warn('repair_exhausted', {
      requestId: ctx.requestId,
      userId:    ctx.userId,
      attempt:   ctx.attempt,
      problems:  ctx.problems,
    })
    return null
  }

  const problemList = ctx.problems.map((p, i) => `  ${i + 1}. ${p}`).join('\n')

  const repairMessage =
    `Your previous plan_diagram call had problems:\n${problemList}\n\n` +
    `Original request: "${ctx.originalUserMessage}"\n\n` +
    `Call plan_diagram again, fixing ONLY these specific problems. ` +
    `Keep everything else about your previous plan the same.`

  try {
    const response = await groq.chat.completions.create({
      model:       'llama-3.3-70b-versatile',
      temperature: 0.2,
      messages: [
        { role: 'system', content: ctx.systemPrompt },
        { role: 'user',   content: repairMessage },
      ],
      tools:       [PLAN_DIAGRAM_TOOL],
      tool_choice: forceTool('plan_diagram'),
    })

    const toolCall = response.choices[0]?.message?.tool_calls?.[0]
    if (!toolCall) {
      logger.warn('repair_no_tool_call', { requestId: ctx.requestId, attempt: ctx.attempt })
      return null
    }

    const repaired = JSON.parse(toolCall.function.arguments) as DiagramPlan

    logger.info('repair_success', {
      requestId: ctx.requestId,
      userId:    ctx.userId,
      attempt:   ctx.attempt,
    })
    return repaired
  } catch (err) {
    logger.warn('repair_call_failed', {
      requestId: ctx.requestId,
      attempt:   ctx.attempt,
      message:   err instanceof Error ? err.message : String(err),
    })
    return null
  }
}
