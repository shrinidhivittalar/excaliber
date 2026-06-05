interface Point { x: number; y: number }

export interface NodeRect {
  id: string
  x: number
  y: number
  width: number
  height: number
}

const BORDER_GAP = 8  // gap between arrowhead and node border stroke

// Returns the point on the border of rect that faces toward `toward`,
// offset outward by BORDER_GAP so the arrowhead doesn't overlap the stroke.
function getBorderAttachment(rect: NodeRect, toward: Point): Point {
  const cx = rect.x + rect.width  / 2
  const cy = rect.y + rect.height / 2
  const dx = toward.x - cx
  const dy = toward.y - cy

  if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) {
    return { x: cx, y: rect.y - BORDER_GAP }
  }

  const hw = rect.width  / 2
  const hh = rect.height / 2
  const scaleX = Math.abs(dx) > 0.1 ? (hw + BORDER_GAP) / Math.abs(dx) : Infinity
  const scaleY = Math.abs(dy) > 0.1 ? (hh + BORDER_GAP) / Math.abs(dy) : Infinity
  const scale  = Math.min(scaleX, scaleY)

  return {
    x: Math.round(cx + dx * scale),
    y: Math.round(cy + dy * scale),
  }
}

// Slab method: returns true if line segment p1→p2 passes through the
// interior of rect (shrunk 4px per side to ignore border-grazing).
function linePassesThroughRect(p1: Point, p2: Point, rect: NodeRect): boolean {
  const minX = rect.x + 4
  const minY = rect.y + 4
  const maxX = rect.x + rect.width  - 4
  const maxY = rect.y + rect.height - 4

  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  let tMin = 0
  let tMax = 1

  if (Math.abs(dx) < 0.1) {
    if (p1.x < minX || p1.x > maxX) return false
  } else {
    const t1 = (minX - p1.x) / dx
    const t2 = (maxX - p1.x) / dx
    tMin = Math.max(tMin, Math.min(t1, t2))
    tMax = Math.min(tMax, Math.max(t1, t2))
    if (tMin > tMax) return false
  }

  if (Math.abs(dy) < 0.1) {
    if (p1.y < minY || p1.y > maxY) return false
  } else {
    const t1 = (minY - p1.y) / dy
    const t2 = (maxY - p1.y) / dy
    tMin = Math.max(tMin, Math.min(t1, t2))
    tMax = Math.min(tMax, Math.max(t1, t2))
    if (tMin > tMax) return false
  }

  return tMin <= tMax
}

function pathClear(route: Point[], obstacles: NodeRect[]): boolean {
  for (let i = 0; i < route.length - 1; i++) {
    for (const obs of obstacles) {
      if (linePassesThroughRect(route[i], route[i + 1], obs)) return false
    }
  }
  return true
}

// Returns an array of waypoints (absolute canvas coords) for an edge
// from `from` to `to`, avoiding all other nodes in `allNodes`.
// Tries in order: straight line → L-bend A → L-bend B → U-bends → fallback.
export function routeEdge(from: NodeRect, to: NodeRect, allNodes: NodeRect[]): Point[] {
  const toCX   = to.x   + to.width  / 2
  const toCY   = to.y   + to.height / 2
  const fromCX = from.x + from.width  / 2
  const fromCY = from.y + from.height / 2

  const start = getBorderAttachment(from, { x: toCX,   y: toCY   })
  const end   = getBorderAttachment(to,   { x: fromCX, y: fromCY })

  const obstacles = allNodes.filter(n => n.id !== from.id && n.id !== to.id)

  // 1. Straight line
  if (pathClear([start, end], obstacles)) return [start, end]

  // 2. L-bend A: go horizontal to target x, then vertical
  const midA: Point = { x: end.x, y: start.y }
  if (pathClear([start, midA, end], obstacles)) return [start, midA, end]

  // 3. L-bend B: go vertical to target y, then horizontal
  const midB: Point = { x: start.x, y: end.y }
  if (pathClear([start, midB, end], obstacles)) return [start, midB, end]

  // 4. U-bends: bypass via an offset waypoint in four cardinal directions
  const cx  = (start.x + end.x) / 2
  const cy  = (start.y + end.y) / 2
  const PAD = 80

  const bypasses: Point[][] = [
    [start, { x: cx, y: Math.min(start.y, end.y) - PAD }, end],
    [start, { x: cx, y: Math.max(start.y, end.y) + PAD }, end],
    [start, { x: Math.min(start.x, end.x) - PAD, y: cy }, end],
    [start, { x: Math.max(start.x, end.x) + PAD, y: cy }, end],
  ]

  for (const route of bypasses) {
    if (pathClear(route, obstacles)) return route
  }

  // 5. Fallback: straight regardless (last resort)
  return [start, end]
}
