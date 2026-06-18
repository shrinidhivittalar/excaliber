import 'dotenv/config'
import { EVAL_CASES, type EvalCase } from './cases'
import { processMessage } from '../ai/groq'

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

async function main() {
  const filter = process.argv[2]  // optional: run just one case by name

  const cases = filter
    ? EVAL_CASES.filter(c => c.name === filter)
    : EVAL_CASES

  if (cases.length === 0) {
    console.error(`No cases match "${filter}"`)
    process.exit(1)
  }

  console.log(`Running ${cases.length} eval case${cases.length !== 1 ? 's' : ''}...\n`)

  const results: CaseResult[] = []
  for (const c of cases) {
    process.stdout.write(`  ${c.name.padEnd(32)} `)
    const r = await runCase(c)
    results.push(r)
    console.log(r.pass ? `PASS  (${r.ms}ms)` : `FAIL  (${r.ms}ms)`)
    if (!r.pass) r.failures.forEach(f => console.log(`    - ${f}`))
  }

  const passed = results.filter(r => r.pass).length
  console.log(`\n${passed}/${results.length} passed`)

  if (passed < results.length) process.exit(1)
}

main().catch(err => { console.error(err); process.exit(1) })
