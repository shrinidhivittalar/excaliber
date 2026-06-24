import 'dotenv/config'
import { EVAL_CASES, MULTI_TURN_EVAL_CASES, type EvalCase, type MultiTurnEvalCase } from './cases'
import { processMessage } from '../ai/groq'
import type { SemanticState } from '../ai/semanticState'
import { logger } from '../lib/logger'

interface CaseResult {
  name:     string
  pass:     boolean
  failures: string[]
  ms:       number
}

const EMPTY_SCENE  = { type: 'excalidraw', version: 2, elements: [], appState: {} }
const FILLED_SCENE = {
  type: 'excalidraw', version: 2, appState: {},
  elements: [
    { id: 'x1', type: 'rectangle', x: 100, y: 100, width: 120, height: 60,
      strokeColor: '#1e1e1e', backgroundColor: 'transparent',
      label: { text: 'Existing Node' } },
  ],
}

async function runCase(c: EvalCase): Promise<CaseResult> {
  const failures: string[] = []
  const t0 = Date.now()

  let result: Awaited<ReturnType<typeof processMessage>>
  try {
    result = await processMessage(
      c.prompt, [], c.canvasIsEmpty ? EMPTY_SCENE : FILLED_SCENE, 'default',
    )
  } catch (err) {
    return {
      name: c.name, pass: false, ms: Date.now() - t0,
      failures: [`processMessage threw: ${err instanceof Error ? err.message : String(err)}`],
    }
  }

  // Intent check
  if (c.expectIntent && result.intent !== c.expectIntent) {
    failures.push(`intent: expected "${c.expectIntent}", got "${result.intent ?? 'undefined'}"`)
  }

  // Tool check
  if (c.expectTool && !result.toolsUsed.includes(c.expectTool)) {
    failures.push(`tool: expected "${c.expectTool}" in [${result.toolsUsed.join(', ')}]`)
  }

  // Node count and entity checks use lastPlan.nodes — MCP (create_view) may
  // not be running in eval context, so sceneJson.elements is unreliable here.
  const plan = result.lastPlan as { nodes?: Array<{ label?: string; sublabel?: string }> } | undefined
  const planNodes = plan?.nodes ?? []
  const nodeCount = planNodes.length

  if (c.minNodes !== undefined && nodeCount < c.minNodes) {
    failures.push(`nodes: expected >= ${c.minNodes}, got ${nodeCount}`)
  }
  if (c.maxNodes !== undefined && nodeCount > c.maxNodes) {
    failures.push(`nodes: expected <= ${c.maxNodes}, got ${nodeCount}`)
  }

  // Entity presence in node labels
  if (c.expectEntities && c.expectEntities.length > 0) {
    const labelBlob = planNodes
      .map(n => `${n.label ?? ''} ${n.sublabel ?? ''}`.toLowerCase())
      .join(' ')

    for (const entity of c.expectEntities) {
      if (!labelBlob.includes(entity.toLowerCase())) {
        failures.push(`entity: "${entity}" not found in any node label`)
      }
    }
  }

  // Group ids (from lastPlan)
  if (c.expectGroupIds && c.expectGroupIds.length > 0) {
    const plan = result.lastPlan as { groups?: Array<{ id: string }> } | undefined
    const foundIds = (plan?.groups ?? []).map(g => g.id)
    for (const gid of c.expectGroupIds) {
      if (!foundIds.includes(gid)) {
        failures.push(`group: "${gid}" not in plan.groups [${foundIds.join(', ')}]`)
      }
    }
  }

  return { name: c.name, pass: failures.length === 0, failures, ms: Date.now() - t0 }
}

async function runMultiTurnCase(
  c: MultiTurnEvalCase
): Promise<{ name: string; pass: boolean; failures: string[]; ms: number }> {
  const failures: string[] = []
  let semanticState: SemanticState | undefined = undefined
  let sceneJson: object = { type: 'excalidraw', version: 2, elements: [], appState: {} }
  const t0 = Date.now()

  for (let i = 0; i < c.turns.length; i++) {
    const turn = c.turns[i]
    let result: Awaited<ReturnType<typeof processMessage>>
    try {
      result = await processMessage(
        turn.prompt, [], sceneJson, 'default',
        undefined, undefined,
        semanticState,
      )
    } catch (err) {
      failures.push(`Turn ${i + 1}: processMessage threw: ${err instanceof Error ? err.message : String(err)}`)
      break
    }

    semanticState = result.semanticState
    sceneJson     = result.sceneJson

    const ss = result.semanticState

    if (turn.expectDomain && ss.domain !== turn.expectDomain) {
      failures.push(`Turn ${i + 1}: expected domain "${turn.expectDomain}", got "${ss.domain}"`)
    }
    if (turn.expectDiagramType && ss.diagramType !== turn.expectDiagramType) {
      failures.push(`Turn ${i + 1}: expected diagramType "${turn.expectDiagramType}", got "${ss.diagramType}"`)
    }
    if (turn.expectEntityIds) {
      const existingIds = new Set(ss.establishedEntities.map(e => e.id))
      for (const id of turn.expectEntityIds) {
        if (!existingIds.has(id)) {
          failures.push(`Turn ${i + 1}: expected entity id "${id}" in establishedEntities [${[...existingIds].join(', ')}]`)
        }
      }
    }
    if (turn.expectOpenThreads !== undefined) {
      const threads = ss.openThreads
      for (const expected of turn.expectOpenThreads) {
        if (!threads.includes(expected)) {
          failures.push(`Turn ${i + 1}: expected open thread "${expected}", got [${threads.join(', ')}]`)
        }
      }
      for (const actual of threads) {
        if (!turn.expectOpenThreads.includes(actual)) {
          failures.push(`Turn ${i + 1}: unexpected open thread "${actual}"`)
        }
      }
    }
    if (turn.minNodes !== undefined) {
      const plan = result.lastPlan as { nodes?: Array<unknown> } | undefined
      const nodeCount = plan?.nodes?.length ?? 0
      if (nodeCount < turn.minNodes) {
        failures.push(`Turn ${i + 1}: expected >= ${turn.minNodes} nodes, got ${nodeCount}`)
      }
    }
  }

  // Cross-turn id consistency: check that specified ids survive to the end
  if (c.expectIdConsistency && semanticState) {
    const finalIds = new Set(semanticState.establishedEntities.map(e => e.id))
    for (const id of c.expectIdConsistency) {
      if (!finalIds.has(id)) {
        failures.push(`Cross-turn: id "${id}" absent from establishedEntities after final turn [${[...finalIds].join(', ')}]`)
      }
    }
  }

  return { name: c.name, pass: failures.length === 0, failures, ms: Date.now() - t0 }
}

async function main() {
  const filter = process.argv[2]  // optional: run just one case by name

  const singleCases = filter
    ? EVAL_CASES.filter(c => c.name === filter)
    : EVAL_CASES

  const multiCases = filter
    ? MULTI_TURN_EVAL_CASES.filter(c => c.name === filter)
    : MULTI_TURN_EVAL_CASES

  if (singleCases.length === 0 && multiCases.length === 0) {
    logger.error('eval_no_cases_match', { filter })
    process.exit(1)
  }

  const totalCount = singleCases.length + multiCases.length
  logger.info('eval_started', { totalCount })

  const results: CaseResult[] = []

  for (const c of singleCases) {
    logger.info('eval_case_started', { name: c.name })
    const r = await runCase(c)
    results.push(r)
    logger.info('eval_case_result', { name: r.name, pass: r.pass, durationMs: r.ms })
    if (!r.pass) r.failures.forEach(f => logger.warn('eval_case_failure', { name: r.name, failure: f }))
  }

  if (multiCases.length > 0) {
    logger.info('eval_multi_turn_started')
    for (const c of multiCases) {
      logger.info('eval_case_started', { name: c.name })
      const r = await runMultiTurnCase(c)
      results.push(r)
      logger.info('eval_case_result', { name: r.name, pass: r.pass, durationMs: r.ms })
      if (!r.pass) r.failures.forEach(f => logger.warn('eval_case_failure', { name: r.name, failure: f }))
    }
  }

  const passed = results.filter(r => r.pass).length
  logger.info('eval_complete', { passed, total: results.length })

  if (passed < results.length) process.exit(1)
}

main().catch(err => { logger.error('eval_failed', { message: err instanceof Error ? err.message : String(err) }); process.exit(1) })


