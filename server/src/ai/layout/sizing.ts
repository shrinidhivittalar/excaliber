import type { NodeSize } from './types'

// Base dimensions per size tier
const SIZE_BASES: Record<NodeSize, { w: number; h: number }> = {
  xs: { w: 90,  h: 40  },
  sm: { w: 130, h: 55  },
  md: { w: 170, h: 70  },
  lg: { w: 220, h: 90  },
  xl: { w: 280, h: 110 },
}

const DEFAULT_SIZE: NodeSize = 'md'
const CHAR_WIDTH = 8.5       // px per character at fontSize 14
const LINE_HEIGHT = 20       // px per line
const H_PADDING = 32         // horizontal padding (each side)
const V_PADDING = 20         // vertical padding (each side)
const MIN_FONT_SIZE = 12
const MAX_FONT_SIZE = 16

export function computeNodeDimensions(
  label: string,
  size: NodeSize = DEFAULT_SIZE,
  shape: string
): { width: number; height: number; fontSize: number } {
  const base = SIZE_BASES[size]

  // Calculate minimum width to fit the label on one line
  const fontSize = size === 'xs' || size === 'sm' ? MIN_FONT_SIZE : MAX_FONT_SIZE
  const charWidth = CHAR_WIDTH * (fontSize / 14)
  const labelPixelWidth = label.length * charWidth + H_PADDING * 2

  // For ellipses, add extra padding because text sits in the center
  const ellipsePad = shape === 'ellipse' ? 32 : 0
  const width = Math.max(base.w, labelPixelWidth + ellipsePad)

  // Calculate how many lines the label needs
  const charsPerLine = Math.floor((width - H_PADDING * 2) / charWidth)
  const lines = Math.max(1, Math.ceil(label.length / charsPerLine))
  const textHeight = lines * LINE_HEIGHT + V_PADDING * 2

  const height = Math.max(base.h, textHeight)

  return { width: Math.round(width), height: Math.round(height), fontSize }
}

export function getNodeSize(size?: NodeSize): NodeSize {
  return size ?? DEFAULT_SIZE
}
