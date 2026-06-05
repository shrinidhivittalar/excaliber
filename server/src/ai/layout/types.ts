import type { DiagramTheme } from './themes'

export type LayoutType =
  | 'flowchart'
  | 'hierarchy'
  | 'circular'
  | 'comparison'
  | 'timeline'
  | 'mindmap'
  | 'freeform'

export type NodeShape = 'rectangle' | 'ellipse' | 'diamond' | 'text'

export type NodeSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export type EdgeStyle = 'solid' | 'dashed' | 'dotted'

export interface DiagramNode {
  id: string
  label: string
  shape: NodeShape
  size?: NodeSize        // relative size hint — server calculates actual px
  group?: string         // group id for color-coding
  sublabel?: string      // smaller secondary text below main label
  emphasis?: boolean     // true = make this node visually prominent
}

export interface DiagramEdge {
  from: string
  to: string
  label?: string
  style?: EdgeStyle
  bidirectional?: boolean
}

export interface DiagramGroup {
  id: string
  label: string
  color?: string
}

export interface DiagramPlan {
  layout: LayoutType
  title?: string
  nodes: DiagramNode[]
  edges?: DiagramEdge[]
  mode?: 'replace' | 'merge'   // 'replace' = full re-layout (default), 'merge' = keep existing positions
  groups?: DiagramGroup[]
  direction?: 'LR' | 'TB'   // left-right or top-bottom (for flowchart/hierarchy)
  theme?: DiagramTheme
}

// What the layout engine produces — ready for Excalidraw
export interface ComputedNode {
  id: string
  x: number
  y: number
  width: number
  height: number
  shape: NodeShape
  label: string
  sublabel?: string
  backgroundColor: string
  strokeColor: string
  fontSize: number
  groupId?: string
}

export interface ComputedEdge {
  fromId: string
  toId: string
  label?: string
  style: EdgeStyle
  bidirectional: boolean
}

export interface ComputedLayout {
  nodes: ComputedNode[]
  edges: ComputedEdge[]
  canvasWidth: number
  canvasHeight: number
  groups: { id: string; label: string; x: number; y: number; width: number; height: number; color: string }[]
}
