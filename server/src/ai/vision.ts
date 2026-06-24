import Groq from 'groq-sdk'
import { logger } from '../lib/logger'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// llama-3.2-11b-vision-preview was decommissioned; scout is the current free-tier vision model
const VISION_MODEL = process.env.GROQ_VISION_MODEL ?? 'meta-llama/llama-4-scout-17b-16e-instruct'

export interface CritiqueResult {
  hasIssues: boolean
  issues:    string[]
}

const VISION_PROMPT = `You are a diagram quality reviewer. Examine this diagram image carefully.

Identify ONLY these specific visual problems — ignore style preferences:
  1. Text overflowing outside a node's border (text visibly cut off or outside the box)
  2. Two or more nodes overlapping each other
  3. An arrow or edge label that is completely unreadable (hidden under a node or another label)
  4. A node so small that its label text cannot be read

Be conservative. If the diagram is readable and the layout is clear,
report no issues even if it is not perfect.

Respond ONLY with a valid JSON object on a single line — no markdown, no explanation:
{ "hasIssues": boolean, "issues": string[] }

If the diagram looks acceptable: { "hasIssues": false, "issues": [] }
If there are problems: { "hasIssues": true, "issues": ["text overflows node X", "nodes Y and Z overlap"] }`

export async function critiqueImage(imageBase64: string): Promise<CritiqueResult> {
  try {
    const response = await groq.chat.completions.create({
      model:      VISION_MODEL,
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: [
            {
              type:      'image_url',
              image_url: { url: `data:image/png;base64,${imageBase64}` },
            },
            {
              type: 'text',
              text: VISION_PROMPT,
            },
          ],
        },
      ],
    })

    if ((response.choices[0]?.finish_reason as string) === 'error') {
      logger.warn('vision_finish_reason_error')
      return { hasIssues: false, issues: [] }
    }

    const raw = response.choices[0]?.message?.content?.trim() ?? ''

    // Strip markdown fences if the model wrapped the JSON anyway
    const clean = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim()

    const parsed = JSON.parse(clean) as CritiqueResult
    return {
      hasIssues: Boolean(parsed.hasIssues),
      issues:    Array.isArray(parsed.issues) ? parsed.issues.slice(0, 5) : [],
    }
  } catch (err) {
    // If vision call fails for any reason, return no issues and let the
    // original diagram through — never block the user over a critique failure
    logger.warn('vision_critique_failed', { message: err instanceof Error ? err.message : String(err) })
    return { hasIssues: false, issues: [] }
  }
}

